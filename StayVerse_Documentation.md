# StayVerse — Platform Architecture, Policies & Technical Documentation

## 1. Executive Summary

This document serves as the comprehensive technical reference for the **StayVerse** vacation rental platform (Node.js / Express / MongoDB Atlas / Redis Cloud / MapLibre GL). It details the core backend systems, algorithmic engines, security mechanisms, and policies implemented across the application:

1. **Cancellation & Refund Policy Architecture**: Policy tiers, calculation rules, idempotency, permanent audit ledgers, and cascading deletion guarantees.
2. **Personalized Recommendation Engine ("Smart Match")**: Algorithmic scoring formula, semantic vibe mappings, Haversine proximity, and 3-tier preference persistence.
3. **Redis Architecture & Integration**: Dual-client architecture, cache-aside strategies, cache keys & TTLs, proactive invalidation, test isolation, and graceful MongoDB failover.
4. **Rate Limiting & API Abuse Protection**: Multi-category Redis-backed limiters, keying strategies, HTTP 429 payload standardization, and reverse-proxy (`trust proxy`) configuration.
5. **Geospatial Indexing (`2dsphere`) & Discovery Architecture**: GeoJSON specifications, `2dsphere` indexing, `$near` and `$geoWithin` queries, MapLibre GL visualization, and Haversine distance computations.
6. **Database Schemas & Data Integrity**: ACID transactions, `Refund` ledger collection, user balance tracking, and geospatial collections.
7. **Verification & Automated Testing**: 100% pass rate across all 10 automated test suites (74 tests).

---

## 2. Cancellation & Refund Policy Architecture

The refund engine is implemented in `services/refundService.js` and orchestrates idempotent refund processing, user balance synchronization, and financial audit logging.

### 2.1 Policy Rules & Refund Tiers

| Trigger / Cancellation Scenario | Timing Condition | Refund Percentage | Policy Applied String |
| :--- | :--- | :---: | :--- |
| **Host Cancellation** | Any time before checkout | **100%** | `100% Full Refund — Host/Property Deletion Guarantee` |
| **Property Deletion** | Any time active booking exists | **100%** | `100% Full Refund — Host/Property Deletion Guarantee` |
| **Admin Cancellation** | Any time | **100%** | `100% Full Refund — Admin Cancellation` |
| **Traveler Cancellation (Early)** | **&ge; 48 hours** before check-in | **100%** | `100% Full Refund — Cancelled > 48h prior to check-in` |
| **Traveler Cancellation (Late)** | **< 48 hours** before check-in | **80%** | `80% Partial Refund — Cancelled within 48h of check-in` (20% retained as host holding fee) |
| **Stay Commenced or Ended** | On or after check-in date | **0%** | `0% Non-refundable — Check-in date has already begun or passed` |

### 2.2 Algorithmic Calculation Logic
```javascript
const calculateRefund = (booking, reason = 'user_cancellation') => {
  if (reason === 'property_deletion' || reason === 'host_cancellation' || reason === 'admin_cancellation') {
    return { amount: Math.round(booking.totalPrice), percentage: 100, policy: '100% Full Refund — Host/Property Deletion Guarantee' };
  }
  const now = new Date();
  const checkIn = new Date(booking.checkIn);
  const diffHours = (checkIn - now) / (1000 * 60 * 60);

  if (diffHours >= 48) {
    return { amount: Math.round(booking.totalPrice), percentage: 100, policy: '100% Full Refund — Cancelled > 48h prior to check-in' };
  } else if (diffHours > 0) {
    return { amount: Math.round(booking.totalPrice * 0.8), percentage: 80, policy: '80% Partial Refund — Cancelled within 48h of check-in' };
  } else {
    return { amount: 0, percentage: 0, policy: '0% Non-refundable — Check-in date has already begun or passed' };
  }
};
```

### 2.3 Permanent Audit Ledger (`Refund` Collection)
Unlike standard booking cancellations that simply alter a status flag, StayVerse records every transaction in a permanent `Refund` document:
- **Financial Audit**: Retains `bookingId`, `user`, `propertyTitle` snapshot, `originalAmount`, `amount`, `refundPercentage`, `policyApplied`, `reason`, and `processedAt`.
- **Permanent Preserved History**: If a property or booking is subsequently deleted, the refund record persists permanently.
- **Idempotency Guard**: Before any refund execution, `Refund.findOne({ bookingId })` ensures duplicate refunds cannot be created or credited twice.
- **User Balance Sync**: Atomically increments `user.cumulativeRefunded` using MongoDB `$inc`.
- **Auto-Reconciliation**: `getUserRefundHistory()` automatically detects and creates ledger records for legacy cancelled bookings, preventing discrepancies between dashboard stats and refund history.

### 2.4 Cascading Property Deletion Guarantee
When a host or admin deletes a property via `propertyService.deleteProperty()`:
1. All active or confirmed bookings for that property are retrieved.
2. 100% full refunds are issued to every affected traveler, creating audit entries and updating traveler balances.
3. Bookings (`Booking.deleteMany({ property: propertyId })`) and reviews (`Review.deleteMany({ property: propertyId })`) are cascaded.
4. Redis cache keys (`property:detail:<id>`, `property:list:*`, `property:geojson`) are purged.
5. The property document is safely deleted without leaving orphan records.

---

## 3. Personalized Recommendation Engine ("Smart Match")

The recommendation system is implemented in `controllers/recommendationController.js` and `services/propertyService.js` (line 521). It matches travelers with stays using an intelligent multi-attribute scoring model.

### 3.1 Preference Extraction & 3-Tier Persistence
Traveler preferences are extracted in hierarchical order:
1. **Live Query Parameters**: Active URL query parameters (`?vibe=beach&minPrice=2000&maxPrice=12000&userLat=...`).
2. **MongoDB User Profile**: If the traveler is authenticated, preferences saved via `POST /recommendations/preferences` are stored in `user.preferences`.
3. **HTTP Cookie**: Stored in a 30-day client cookie (`stayverse_preferences`), enabling seamless personalization across sessions even for guest users.

### 3.2 Scoring Formula & Weight Distribution

Every property in the catalog is evaluated across 6 criteria producing a composite match score between **35% and 99%**:

$$\text{Composite Score} = \text{PriceScore} + \text{VibeScore} + \text{AmenityScore} + \text{ProximityScore} + \text{RegionScore} + \text{RatingScore}$$

| Scoring Dimension | Max Points | Evaluation Algorithm |
| :--- | :---: | :--- |
| **Price Alignment** | **30 pts** | Exact budget match: **30 pts**. Within 25% below budget: **24 pts**. Within 30% above budget: **18 pts**. Outside range: **5 pts**. |
| **Vibe Semantic Match** | **25 pts** | Semantic keyword scan over title, description, amenities, and city. &ge;2 keyword hits: **25 pts**. 1 hit: **18 pts**. 0 hits: **6 pts**. |
| **Amenity Overlap** | **25 pts** | Ratio of requested amenities present in property: $\text{AmenityScore} = \text{round}\left(\frac{\text{matched}}{\text{requested}} \times 25\right)$. |
| **Proximity & Distance** | **18 pts** | Computed via the **Haversine formula**. Within requested radius: **18 pts**. &le;50 km: **15 pts**. &le;200 km: **10 pts**. >200 km: **5 pts**. Strict radius filtering excludes out-of-bounds listings. |
| **Region / Destination** | **10 pts** | Region filtering (`india`, `international`, or exact city string match): **10 pts** on match; partial: **3 pts**. |
| **Guest Rating** | **10 pts** | &ge;4.7★: **10 pts**. &ge;4.0★: **7 pts**. &lt;4.0★: **5 pts**. Enforces strict threshold if `minRating` is specified. |

### 3.3 Semantic Travel Vibes
The engine supports 8 curated travel vibes, mapped to contextual keywords:
- **`beach`**: `beach`, `beachfront`, `ocean`, `coastal`, `sea`, `sand`, `snorkeling`, `surf`, `waterfront`, `plunge pool`, `sundeck`, `cabana`, `coral`
- **`mountain`**: `mountain`, `alpine`, `pine`, `forest`, `cabin`, `hot tub`, `fireplace`, `snow`, `glacier`, `chalet`, `ski`, `himalayan`, `altitude`, `peak`
- **`heritage`**: `heritage`, `haveli`, `palace`, `historic`, `fort`, `temple`, `architecture`, `traditional`, `stone`, `18th-century`, `carved`, `marble`, `restored`, `vineyard`
- **`city`**: `city`, `loft`, `skyline`, `downtown`, `penthouse`, `urban`, `modern`, `hitec`, `studio`, `elevator`, `high-floor`, `terrace`
- **`lake`**: `lake`, `lakeside`, `river`, `water`, `houseboat`, `backwaters`, `perfect-stay`, `dam`, `boat`, `lagoon`, `canal`
- **`wellness`**: `wellness`, `yoga`, `ashram`, `retreat`, `spiritual`, `meditation`, `spa`, `ayurvedic`, `tranquil`, `peaceful`, `organic`
- **`workcation`**: `wifi`, `workspace`, `fibre`, `internet`, `dedicated workspace`, `desk`, `high-speed`, `remote work`, `quiet`
- **`luxury`**: `luxury`, `villa`, `infinity`, `penthouse`, `palace`, `private pool`, `suite`, `chef`, `safari`, `glamping`

### 3.4 Match Grades & Badges
- **Exceptional Match** (&ge; 90%): Renders green badge (`badge-exceptional`) with highlighted match reasons.
- **Great Match** (78% – 89%): Renders blue badge (`badge-great`).
- **Good Match** (35% – 77%): Renders muted badge (`badge-good`).

---

## 4. Where Redis is Used

Redis is integrated as a high-performance distributed layer for **in-memory data caching** and **rate-limit state synchronization**.

### 4.1 Redis Clients Overview

Two dedicated Redis clients operate in StayVerse:

1. **`services/cacheService.js` (`ioredis`)**:
   - Manages application-level caching (listings, single property view, GeoJSON map coordinates).
   - Configured with `lazyConnect: true`, `enableOfflineQueue: false`, connect timeouts, and non-blocking retry strategy.
   - Cleans connection strings (supports standard `redis://` and CLI-style strings).
   - In test environments, automatically prepends `stayverse:test:` to keys for sandbox isolation.

2. **`config/redis.js` (official `redis` npm package)**:
   - Provides a shared client for `rate-limit-redis`.
   - Reusable singleton with automatic exponential backoff reconnection.

### 4.2 Caching Strategy & Key Inventory

| Cache Target | Redis Key Pattern | TTL (Seconds) | Description & Invalidation Trigger |
| :--- | :--- | :---: | :--- |
| **Filtered Property Lists** | `property:list:<normalizedQueryStr>` | **300s** (5 min) | Caches MongoDB search/filter query results. Invalidated on property create, update, or delete. |
| **Single Property Details** | `property:detail:<propertyId>` | **600s** (10 min) | Caches property document + populated host data. Invalidated on property update or delete. |
| **Map Explorer GeoJSON** | `property:geojson` | **300s** (5 min) | Caches all active properties formatted as GeoJSON FeatureCollection. Invalidated on create, update, or delete. |
| **Test Environment** | `stayverse:test:*` | Dynamic | Isolated test cache prefix preventing mock test data from polluting production Redis keys. |

### 4.3 How Redis is Checked: Step-by-Step Cache-Aside Lifecycle

Whenever a user requests data (browsing listings, opening a property page, or loading the map), StayVerse executes the following lifecycle:

```
                  User HTTP Request
                          │
                          ▼
            1. Build Normalized Cache Key
                          │
                          ▼
             2. Check Redis (cacheService.get)
                     /         \
          [CACHE HIT]           [CACHE MISS / EXPIRED]
              │                            │
              ▼                            ▼
  Return cached JSON instantly       3. Query MongoDB Atlas
  (< 5ms, 0 DB queries)                    │
                                           ▼
                                 4. Save result in Redis (SET with TTL)
                                           │
                                           ▼
                                 5. Return fresh data to user
```

1. **Key Formulation**: The server constructs a unique key for the requested resource (e.g. `property:detail:67285a8f4c20b...` or `property:list:city=Goa&page=1`).
2. **Cache Check (`cacheService.get(key)`)**:
   - **Cache HIT**: If the key exists in Redis and has not expired, `JSON.parse()` deserializes the cached payload and returns it immediately in &lt;5ms without executing a MongoDB query.
   - **Cache MISS**: If the key is absent or expired, `cacheService.get()` returns `null`.
3. **Database Fallback**: The service executes the primary MongoDB Atlas query (e.g. `Property.findById(id).populate('host')` or geospatial `$near` query).
4. **Cache Hydration (`cacheService.set(key, data, ttl)`)**: The fresh database document is serialized to JSON and stored in Redis with an explicit TTL (`EX`).
5. **Response Delivery**: The fresh data is delivered to the client.

### 4.4 Normalized Key Construction Logic

To avoid redundant duplicate cache entries for the same query with different parameter ordering (e.g. `?city=Goa&page=1` vs `?page=1&city=Goa`), StayVerse normalizes query parameters alphabetically before hashing:

```javascript
// From services/propertyService.js:
const sortedParamKeys = Object.keys(queryParams).sort();
const normalizedQueryStr = sortedParamKeys
  .map((k) => `${k}=${queryParams[k]}`)
  .join('&');
const cacheKey = `property:list:${normalizedQueryStr || 'default'}`;
```

### 4.5 Wildcard Pattern Invalidation (`delByPattern`)

When a property is **created**, **updated**, or **deleted**, any cached search results or map coordinates become stale. StayVerse purges matching keys using Redis pattern scanning:

```javascript
// Triggered on updateProperty() and deleteProperty():
await cacheService.del(`property:detail:${propertyId}`); // Purge exact property detail
await cacheService.delByPattern('property:list:*');       // Purge ALL filtered listing caches
await cacheService.del('property:geojson');               // Purge MapLibre pins
```

`delByPattern('property:list:*')` executes non-blocking `SCAN` operations (in batches of 100) to find all keys matching the wildcard pattern and deletes them atomically via `del(...keys)`, ensuring the next browsing request fetches fresh database state.

### 4.6 Graceful Fallback & High Availability
- If Redis is unavailable or disconnected, `cacheService` catches errors, logs a diagnostic warning, and returns `null`.
- The application automatically falls back to querying MongoDB Atlas directly without throwing errors or breaking user requests.
- Rate limiting automatically fails open (`passOnStoreError: true`) using an in-memory fallback.

---

## 5. Where Rate Limiting is Used

Rate limiting is implemented via `middleware/rateLimitMiddleware.js` using `express-rate-limit` with `rate-limit-redis`. It defends StayVerse against brute-force attacks, reservation hoarding, review spam, and API scraping.

### 5.1 Endpoint Categories & Configurations

| Category Limiter | Protected Endpoints | Window | Max Req | Redis Key Prefix | Defense Scope & Strategy |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Authentication** (`authLimiter`) | `POST /auth/login`<br>`POST /auth/register`<br>`POST /profile/password`<br>`PUT /profile/password` | **15 min** | **10 req** | `stayverse:rl:auth:` | Strict brute-force credential stuffing and password guessing protection. |
| **Bookings** (`bookingLimiter`) | `POST /properties/:id/bookings`<br>`POST /bookings/:id/cancel`<br>`DELETE /bookings/:id` | **10 min** | **20 req** | `stayverse:rl:booking:` | Anti-reservation hoarding, duplicate booking spam, and cancellation abuse. |
| **Property Mutations** (`propertyMutationLimiter`) | `POST /properties`<br>`PUT /properties/:id`<br>`DELETE /properties/:id` | **15 min** | **25 req** | `stayverse:rl:prop_mut:` | Prevents property listing spam, unauthorized mutations, and deletion loops. |
| **Property Browsing** (`propertyBrowseLimiter`) | `GET /properties`<br>`GET /properties/geojson`<br>`GET /properties/nearby`<br>`GET /properties/:id` | **1 min** | **120 req** | `stayverse:rl:prop_browse:` | High-throughput browsing allowance while preventing aggressive web scraping. |
| **Reviews** (`reviewLimiter`) | `POST /properties/:id/reviews`<br>`DELETE /reviews/:id` | **15 min** | **20 req** | `stayverse:rl:review:` | Prevents automated review generation, rating manipulation, and review deletion spam. |
| **Global API** (`globalApiLimiter`) | Blanket protection across all `/api/*` routes | **15 min** | **300 req** | `stayverse:rl:global_api:` | Catch-all boundary preventing general API flooding. |

### 5.2 Keying Strategy: User ID vs IP Address
- **Unauthenticated / Anonymous Requests**: Keyed by client IP (`req.ip`).
- **Authenticated Sessions**: Keyed by `user._id` (`req.user.id`). This prevents attackers from circumventing limits by switching IP addresses or rotating proxies.

### 5.3 Standardized HTTP 429 Responses
When a rate limit is exceeded, the server returns an HTTP `429 Too Many Requests` response:
- **API Requests** (`/api/*`, `Accept: application/json`):
  ```json
  {
    "success": false,
    "statusCode": 429,
    "error": "Too Many Requests",
    "message": "Too many requests to this endpoint. Please slow down and try again later.",
    "category": "auth",
    "retryAfterSeconds": 900
  }
  ```
- **Browser Requests**: Renders the styled `views/errors/error.ejs` template displaying a user-friendly message and the remaining cool-down duration.
- **Headers Sent**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.

### 5.4 Reverse Proxy Security (`trust proxy`)
In `app.js`, `app.set('trust proxy', 1)` is enabled. This ensures that when deployed behind Render, Cloudflare, AWS ALB, or Nginx:
- Express correctly extracts the genuine client IP from `X-Forwarded-For`.
- Rate limiting targets the actual client rather than the shared reverse-proxy IP.

---

## 6. Geospatial Indexing (`2dsphere`) & Discovery Architecture

StayVerse enables real-time geospatial discovery, radius searches, distance calculations, and interactive map visualizations. This is powered by MongoDB's **`2dsphere` spatial indexing engine**, the GeoJSON standard, and MapLibre GL.

### 6.1 GeoJSON Specification in `models/Property.js`

In MongoDB, geospatial coordinates are stored using the official **GeoJSON Point** format:

```javascript
// models/Property.js
location: {
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
    required: true,
  },
  // GeoJSON standard: [longitude, latitude]
  coordinates: {
    type: [Number],
    required: [true, 'Coordinates [longitude, latitude] are required'],
    validate: {
      validator(coords) {
        return (
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] >= -180 && coords[0] <= 180 && // Longitude (-180 to 180)
          coords[1] >= -90 && coords[1] <= 90     // Latitude (-90 to 90)
        );
      },
      message: 'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]',
    },
  },
}
```

> [!IMPORTANT]
> **Coordinate Order (`[longitude, latitude]`)**:
> In standard human speech, people say *"latitude, longitude"*. However, the GeoJSON standard and MongoDB `2dsphere` strictly require **`[longitude, latitude]`** (representing `[X, Y]` on an axis). StayVerse strictly validates and stores coordinates in this order.

### 6.2 The `2dsphere` Index

The spatial index is declared at the bottom of `models/Property.js` (line 123):

```javascript
propertySchema.index({ location: '2dsphere' });
```

**Why `2dsphere`?**
* **Spherical Geometry**: Unlike legacy `2d` flat-plane indexes, `2dsphere` calculates distances over the Earth's curved spherical surface (WGS84 datum).
* **High Performance**: Evaluates distances and polygon containment using spatial B-tree index structures, returning nearest neighbors in milliseconds even across millions of records.

### 6.3 Where and How Geospatial Indexing is Used

#### 1. Proximity Searching via `$near` (`services/propertyService.js`)
When a user searches for stays near their location or an entered city with a radius (e.g. `?lng=73.8567&lat=18.5204&radius=50`):

```javascript
// services/propertyService.js (lines 56–69)
const hasGeo = lng && lat && !isNaN(Number(lng)) && !isNaN(Number(lat));
if (hasGeo) {
  const radiusKm = Math.max(1, Number(radius) || 50);
  query.location = {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)], // [longitude, latitude]
      },
      $maxDistance: radiusKm * 1000, // MongoDB expects distance in METERS
    },
  };
}
```
* MongoDB searches outwards from the traveler's coordinates up to `$maxDistance` (in meters).
* Results are naturally returned sorted from closest to farthest.

#### 2. Pagination & Counting via `$geoWithin` with `$centerSphere`
MongoDB restricts the use of `$near` with `countDocuments()`. To calculate total matching records for pagination without errors, StayVerse converts the `$near` query to a spherical bounding circle:

```javascript
// services/propertyService.js (lines 103–115)
const countQuery = { ...query };
if (countQuery.location && countQuery.location.$near) {
  const coords = countQuery.location.$near.$geometry.coordinates;
  const maxDistanceMeters = countQuery.location.$near.$maxDistance;
  // Earth's mean radius is approx 6,378,100 meters
  const radiusRadians = maxDistanceMeters / 6378100;
  countQuery.location = {
    $geoWithin: {
      $centerSphere: [coords, radiusRadians], // [coordinates, radius in radians]
    },
  };
}
const total = await Property.countDocuments(countQuery);
```

#### 3. "Similar Stays Nearby" Discovery (`getSimilarProperties`)
On individual property pages (`/properties/:id`), StayVerse suggests nearby properties using a 1,500 km radius query:

```javascript
// services/propertyService.js (lines 472–480)
query.location = {
  $near: {
    $geometry: {
      type: 'Point',
      coordinates: currentProperty.location.coordinates,
    },
    $maxDistance: 1500000, // 1500 km in meters
  },
};
```

#### 4. Interactive MapLibre GL GeoJSON Endpoint (`GET /properties/geojson`)
The interactive map needs all properties formatted into a standard GeoJSON FeatureCollection. The backend compiles and serves this via `services/propertyService.js` (cached in Redis under `property:geojson` for 5 minutes):

```javascript
const geojson = {
  type: 'FeatureCollection',
  features: properties.map((p) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: p.location.coordinates, // [lng, lat]
    },
    properties: {
      id: p._id,
      title: p.title,
      price: p.pricePerNight,
      priceUnit: p.priceUnit || 'night',
      city: p.city,
      country: p.country,
      rating: p.averageRating,
      image: p.images[0]?.url,
    },
  })),
};
```

#### 5. Haversine Distance Fallback in Recommendation Scoring
When scoring personalized recommendations across arbitrary coordinate pairs, StayVerse calculates great-circle distance in kilometers using the mathematical **Haversine formula**:

```javascript
// services/propertyService.js (lines 6–18)
const calculateHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Returns distance in kilometers
};
```

---

## 7. Database Schema Specifications

### 7.1 `Refund` Collection Schema
```javascript
const refundSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', index: true },
  propertyTitle: { type: String, default: 'Vacation Rental Property' },
  amount: { type: Number, required: true, min: [0, 'Refund amount cannot be negative'] },
  originalAmount: { type: Number, required: true, min: [0, 'Original amount cannot be negative'] },
  refundPercentage: { type: Number, default: 100, min: 0, max: 100 },
  reason: {
    type: String,
    enum: ['user_cancellation', 'property_deletion', 'admin_cancellation', 'host_cancellation', 'manual_adjustment'],
    default: 'user_cancellation',
  },
  policyApplied: { type: String, default: 'Standard Cancellation & Refund Policy' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  processedAt: { type: Date, default: Date.now, index: true },
  notes: { type: String, default: '' },
});
```

### 7.2 `User` Collection Extensions
```javascript
cumulativeRefunded: {
  type: Number,
  default: 0,
  min: [0, 'Cumulative refunded cannot be negative']
},
preferences: {
  vibe: { type: String, default: '' },
  region: { type: String, default: 'all' },
  minPrice: { type: Number, default: 0 },
  maxPrice: { type: Number, default: 30000 },
  minRating: { type: Number, default: 0 },
  amenities: [{ type: String }],
  city: { type: String, default: '' },
  radius: { type: Number, default: 0 }
}
```

### 7.3 `Booking` Collection Extensions
```javascript
refundAmount: { type: Number, default: 0, min: [0, 'Refund amount cannot be negative'] },
refundStatus: { type: String, enum: ['none', 'partial', 'full'], default: 'none' },
refundedAt: { type: Date }
```

---

## 8. Verification & Automated Test Results

The entire test suite is executable via `npm test` and runs against an isolated in-memory MongoDB server with Redis sandbox mocking:

```bash
cd stayverse
npm test
```

### Test Suite Execution Summary

```
Test Suites: 10 passed, 10 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        43.567 s
```

| Test Suite | Tests | Scope Covered |
| :--- | :---: | :--- |
| `tests/profile.test.js` | **6/6 PASSED** | Access control 302 redirect, profile stats rendering, name/email update, empty validation, password verification & bcrypt update. |
| `tests/rateLimiting.test.js` | **5/5 PASSED** | Redis rate-limit enforcement, HTTP 429 response body, RateLimit headers, category threshold differentiation, user ID keying, and Redis failover resilience. |
| `tests/enhancements.test.js` | **8/8 PASSED** | Rebranding to "Perfect Stay", cascading deletion of bookings & reviews, refund ledger entry, refund idempotency, Redis fallback, MapLibre markers & popups. |
| `tests/bookings.test.js` | **8/8 PASSED** | Booking lifecycle, date validation, pricing calculation, concurrency checks, and review eligibility. |
| `tests/preferenceRecommendations.test.js` | **7/7 PASSED** | Scoring algorithm, vibe keywords, amenity match ratio, radius & Haversine distance, and 3-tier preference persistence. |
| `tests/phase0.test.js` – `tests/phase6.test.js` | **40/40 PASSED** | Core authentication, RBAC authorization, CRUD operations, 2dsphere geospatial search, reviews, and template rendering. |
| `testConcurrency.js` | **PASSED** | Concurrent booking simulation verifying zero double-booking overlaps under ACID transactions. |
