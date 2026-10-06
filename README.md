# StayVerse — A Modern Vacation Rental Platform

StayVerse is an enterprise-grade full-stack vacation rental platform connecting travelers with verified vacation homes and empowering hosts to manage their properties. Engineered with a strict **MVC architecture**, **2dsphere geospatial indexing**, and **ACID transaction-backed concurrency control**.

---

## 🏗️ Architecture & Technologies

### Backend & Database
- **Runtime:** Node.js (v24+)
- **Framework:** Express.js
- **Database:** MongoDB Atlas with Mongoose ODM
- **Geospatial Index:** `2dsphere` on property coordinates `[longitude, latitude]`
- **Authentication:** JWT with HTTP-only cookies and bcryptjs
- **Image Storage:** Cloudinary + Multer

### Frontend & UI
- **Template Engine:** EJS + `ejs-mate` layouts
- **Styling:** Custom Vanilla CSS Design System with dark mode aesthetics
- **Interactive Maps:** MapLibre GL JS
- **Micro-interactions:** Vanilla JavaScript

---

## 📁 Repository Structure

```
stayverse/
├── app.js                   # Express application configuration & middleware pipeline
├── server.js                # Server entry point with graceful shutdown
├── package.json             # Dependencies and scripts
├── .env                     # Local environment configuration
├── .env.example             # Template for environment configuration
├── .gitignore
├── README.md
│
├── config/
│   ├── db.js                # MongoDB connection lifecycle management
│   └── cloudinary.js        # Cloudinary SDK & storage engine (Phase 2)
│
├── models/
│   ├── User.js              # Traveler and Host schema (Phase 1)
│   ├── Property.js          # Vacation rental listing schema (Phase 2)
│   ├── Booking.js           # Reservation schema with concurrency isolation (Phase 4)
│   └── Review.js            # Rating and review aggregation schema (Phase 5)
│
├── controllers/             # Route handlers
├── routes/                  # Express RESTful route declarations
├── middleware/
│   ├── authMiddleware.js    # JWT verification
│   ├── roleMiddleware.js    # RBAC (host/traveler) authorization
│   ├── errorMiddleware.js   # Centralized error handler & 404 handler
│   └── uploadMiddleware.js  # Multer file upload handler
│
├── services/                # Reusable business logic (Booking, Ranking)
├── utils/                   # Helpers (ExpressError, tokens, date arithmetic)
│
├── views/                   # EJS templates
│   ├── layouts/             # Master layout boilerplate
│   ├── partials/            # Reusable navbar, footer, alerts
│   ├── errors/              # 404, 403, 500 status views
│   ├── auth/                # Login & register pages
│   ├── properties/          # Listing exploration & details
│   ├── bookings/            # Reservation flows
│   ├── reviews/             # Review submissions
│   └── dashboard/           # Traveler and Host dashboards
│
├── public/                  # Static assets
│   ├── css/style.css        # Core design system
│   └── js/main.js           # Interactive UI scripts
│
└── tests/                   # Automated test suites
    └── phase0.test.js       # Phase 0 verification tests
```

---

## 🚀 Getting Started

### 1. Installation
Navigate into the `stayverse` folder and install dependencies:
```bash
cd stayverse
npm install
```

### 2. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
Ensure the variables in `.env` are configured:
```ini
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/stayverse?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MAPLIBRE_STYLE_URL=https://demotiles.maplibre.org/style.json
```

### 3. Run the Development Server
```bash
npm run dev
# or
npm start
```
Visit `http://localhost:3000` in your browser.

### 4. Run Automated Tests
```bash
npm test
```

---

## 📦 Incremental Roadmap

- [x] **PHASE 0:** Project Foundation & Architecture (Express, MongoDB, MVC, EJS, Error Handling, Tests)
- [ ] **PHASE 1:** Authentication & Security (Traveler/Host JWT, bcryptjs, RBAC Middleware)
- [ ] **PHASE 2:** Property Management (CRUD, Cloudinary Images, Filters)
- [ ] **PHASE 3:** Geospatial Mapping (MapLibre GL, 2dsphere `$near` Search)
- [ ] **PHASE 4:** Concurrency-Safe Booking Engine (ACID Overlap Prevention)
- [ ] **PHASE 5:** Reviews & Ratings (Verified Guest Only Aggregation)
- [ ] **PHASE 6:** Smart Proximity & Quality Recommendations
- [ ] **PHASE 7:** UI Refinement & Polish
- [ ] **PHASE 8:** End-to-End Testing & Integration
- [ ] **PHASE 9:** Production Deployment Readiness
