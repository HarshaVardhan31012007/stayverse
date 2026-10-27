const Property = require('../models/Property');
const { formatUploadedImages } = require('../middleware/uploadMiddleware');

// Great-circle distance between two GPS coordinates in kilometers
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
  return R * c;
};

/**
 * Service handling property business logic
 */
class PropertyService {
  /**
   * Query properties with filtering, search, sorting, and pagination
   */
  async listProperties(queryParams = {}) {
    const {
      search,
      city,
      minPrice,
      maxPrice,
      amenity,
      lng,
      lat,
      radius = 200,
      sort = 'newest',
      page = 1,
      limit = 12,
    } = queryParams;

    const query = {};

    // Geospatial Proximity Search ($near query using 2dsphere index)
    const hasGeo = lng && lat && !isNaN(Number(lng)) && !isNaN(Number(lat));
    if (hasGeo) {
      const radiusKm = Math.max(1, Number(radius) || 50);
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusKm * 1000,
        },
      };
    }

    // Basic text search across title, description, and city
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { city: searchRegex }];
    }

    // Direct city filter
    if (city && city.trim()) {
      query.city = new RegExp(city.trim(), 'i');
    }

    // Price range filters
    if (minPrice || maxPrice) {
      query.pricePerNight = {};
      if (minPrice && !isNaN(Number(minPrice))) {
        query.pricePerNight.$gte = Number(minPrice);
      }
      if (maxPrice && !isNaN(Number(maxPrice))) {
        query.pricePerNight.$lte = Number(maxPrice);
      }
    }

    // Amenity filter
    if (amenity && amenity.trim()) {
      query.amenities = { $in: [amenity.trim()] };
    }

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;

    // For countDocuments, MongoDB requires $geoWithin instead of $near
    const countQuery = { ...query };
    if (countQuery.location && countQuery.location.$near) {
      const coords = countQuery.location.$near.$geometry.coordinates;
      const maxDistanceMeters = countQuery.location.$near.$maxDistance;
      // Earth equatorial radius in meters is approx 6,378,100 m
      const radiusRadians = maxDistanceMeters / 6378100;
      countQuery.location = {
        $geoWithin: {
          $centerSphere: [coords, radiusRadians],
        },
      };
    }

    const total = await Property.countDocuments(countQuery);
    const totalPages = Math.ceil(total / limitNum) || 1;

    let properties;

    if (hasGeo) {
      // When geo ($near) is active, MongoDB forces proximity-sorted order and ignores .sort().
      // Workaround: fetch ALL geo results (no skip/limit), then sort in-memory, then paginate.
      let allGeoResults = await Property.find(query).populate('host', 'name email');

      // Apply user-selected sort in JavaScript
      if (sort === 'price-asc') {
        allGeoResults.sort((a, b) => a.pricePerNight - b.pricePerNight);
      } else if (sort === 'price-desc') {
        allGeoResults.sort((a, b) => b.pricePerNight - a.pricePerNight);
      } else if (sort === 'rating') {
        allGeoResults.sort((a, b) => {
          if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
          return b.reviewCount - a.reviewCount;
        });
      } else if (sort === 'newest') {
        allGeoResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      // default (no sort param): keep proximity order from $near

      properties = allGeoResults.slice(skip, skip + limitNum);
    } else {
      // Without geo, apply MongoDB sort and pagination normally
      let sortOptions = { createdAt: -1 };
      if (sort === 'price-asc') sortOptions = { pricePerNight: 1 };
      if (sort === 'price-desc') sortOptions = { pricePerNight: -1 };
      if (sort === 'rating') sortOptions = { averageRating: -1, reviewCount: -1 };
      if (sort === 'newest') sortOptions = { createdAt: -1 };

      properties = await Property.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('host', 'name email');
    }

    // Graceful fallback: if geolocation returned zero results, retry without geo constraint
    if (properties.length === 0 && hasGeo) {
      const fallbackQuery = {};
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        fallbackQuery.$or = [{ title: searchRegex }, { description: searchRegex }, { city: searchRegex }];
      }
      if (city && city.trim()) fallbackQuery.city = new RegExp(city.trim(), 'i');
      if (minPrice || maxPrice) {
        fallbackQuery.pricePerNight = {};
        if (minPrice && !isNaN(Number(minPrice))) fallbackQuery.pricePerNight.$gte = Number(minPrice);
        if (maxPrice && !isNaN(Number(maxPrice))) fallbackQuery.pricePerNight.$lte = Number(maxPrice);
      }
      if (amenity && amenity.trim()) fallbackQuery.amenities = { $in: [amenity.trim()] };

      const fallbackSort = sort === 'price-asc' ? { pricePerNight: 1 }
        : sort === 'price-desc' ? { pricePerNight: -1 }
        : sort === 'rating' ? { averageRating: -1, reviewCount: -1 }
        : { createdAt: -1 };

      const fallbackTotal = await Property.countDocuments(fallbackQuery);
      properties = await Property.find(fallbackQuery)
        .sort(fallbackSort)
        .skip(skip)
        .limit(limitNum)
        .populate('host', 'name email');

      return {
        properties,
        pagination: {
          total: fallbackTotal,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(fallbackTotal / limitNum) || 1,
          hasPrevPage: pageNum > 1,
          hasNextPage: pageNum < Math.ceil(fallbackTotal / limitNum),
        },
        geoFallback: true, // signal to view that geo search had no results
      };
    }

    return {
      properties,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasPrevPage: pageNum > 1,
        hasNextPage: pageNum < totalPages,
      },
    };
  }

  /**
   * Retrieve listings in GeoJSON FeatureCollection format for interactive maps
   */
  async getPropertiesGeoJSON(queryParams = {}) {
    const result = await this.listProperties({ ...queryParams, limit: 100, page: 1 });
    return {
      type: 'FeatureCollection',
      features: result.properties
        .filter((p) => p.location && p.location.coordinates && p.location.coordinates.length === 2)
        .map((p) => ({
          type: 'Feature',
          geometry: p.location,
          properties: {
            id: p._id,
            title: p.title,
            city: p.city,
            country: p.country,
            price: p.pricePerNight,
            priceUnit: p.priceUnit || 'night',
            rating: p.averageRating,
            reviewCount: p.reviewCount,
            image:
              p.images && p.images[0] && p.images[0].url
                ? p.images[0].url
                : 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
          },
        })),
    };
  }

  /**
   * Retrieve property by ID with host details
   */
  async getPropertyById(id) {
    return Property.findById(id).populate('host', 'name email');
  }

  /**
   * Retrieve all properties owned by a specific host
   */
  async getHostProperties(hostId) {
    return Property.find({ host: hostId }).sort({ createdAt: -1 });
  }

  /**
   * Create a new property
   */
  async createProperty(data, hostId, files = []) {
    const {
      title,
      description,
      pricePerNight,
      priceUnit = 'night',
      address,
      city,
      country,
      latitude,
      longitude,
      amenities,
    } = data;

    // Normalize amenities to an array
    let normalizedAmenities = [];
    if (Array.isArray(amenities)) {
      normalizedAmenities = amenities;
    } else if (typeof amenities === 'string' && amenities.trim()) {
      normalizedAmenities = amenities.split(',').map((a) => a.trim());
    }

    // Format images
    const uploadedImages = formatUploadedImages(files);

    const validPriceUnits = ['night', 'day', 'week', 'month'];
    const chosenUnit = validPriceUnits.includes(priceUnit) ? priceUnit : 'night';

    const property = new Property({
      title: title.trim(),
      description: description.trim(),
      pricePerNight: Number(pricePerNight),
      priceUnit: chosenUnit,
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      location: {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      },
      amenities: normalizedAmenities,
      host: hostId,
      ...(uploadedImages.length > 0 && { images: uploadedImages }),
    });

    return property.save();
  }

  /**
   * Update an existing property
   */
  async updateProperty(property, data, files = []) {
    const {
      title,
      description,
      pricePerNight,
      priceUnit,
      address,
      city,
      country,
      latitude,
      longitude,
      amenities,
    } = data;

    if (title) property.title = title.trim();
    if (description) property.description = description.trim();
    if (pricePerNight) property.pricePerNight = Number(pricePerNight);
    if (priceUnit && ['night', 'day', 'week', 'month'].includes(priceUnit)) {
      property.priceUnit = priceUnit;
    }
    if (address) property.address = address.trim();
    if (city) property.city = city.trim();
    if (country) property.country = country.trim();

    if (longitude !== undefined && latitude !== undefined) {
      property.location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    if (amenities !== undefined) {
      if (Array.isArray(amenities)) {
        property.amenities = amenities;
      } else if (typeof amenities === 'string') {
        property.amenities = amenities.split(',').map((a) => a.trim()).filter(Boolean);
      }
    }

    // Append newly uploaded images if provided
    const newImages = formatUploadedImages(files);
    if (newImages.length > 0) {
      property.images.push(...newImages);
    }

    return property.save();
  }

  /**
   * Delete a property
   */
  async deleteProperty(property) {
    return Property.findByIdAndDelete(property._id);
  }

  /**
   * Smart Proximity & Quality Recommendations (Phase 6):
   * Finds similar properties based on geospatial proximity, comparable price range, and high ratings.
   */
  async getRecommendations(propertyId, limit = 3) {
    const currentProperty = await Property.findById(propertyId);
    if (!currentProperty) return [];

    const minPrice = Math.round(currentProperty.pricePerNight * 0.6);
    const maxPrice = Math.round(currentProperty.pricePerNight * 1.4);

    let query = {
      _id: { $ne: currentProperty._id },
      pricePerNight: { $gte: minPrice, $lte: maxPrice },
    };

    // If coordinates exist, prioritize proximity search
    if (
      currentProperty.location &&
      Array.isArray(currentProperty.location.coordinates) &&
      currentProperty.location.coordinates.length === 2
    ) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: currentProperty.location.coordinates,
          },
          $maxDistance: 1500000, // 1500 km
        },
      };
    } else {
      query.city = currentProperty.city;
    }

    let recommendations = [];
    try {
      recommendations = await Property.find(query)
        .limit(limit)
        .populate('host', 'name email');
    } catch (err) {
      // If $near query fails due to no index or other issue, fallback gracefully
      recommendations = await Property.find({ _id: { $ne: currentProperty._id }, city: currentProperty.city })
        .sort({ averageRating: -1 })
        .limit(limit)
        .populate('host', 'name email');
    }

    // Fallback: If fewer than limit, fill with top-rated alternative properties
    if (recommendations.length < limit) {
      const existingIds = [currentProperty._id, ...recommendations.map((p) => p._id)];
      const fallbackStays = await Property.find({ _id: { $nin: existingIds } })
        .sort({ averageRating: -1, reviewCount: -1 })
        .limit(limit - recommendations.length)
        .populate('host', 'name email');

      recommendations = [...recommendations, ...fallbackStays];
    }

    return recommendations;
  }

  /**
   * Smart Preference-Based Recommendation Engine:
   * Scores and ranks properties based on user preferences:
   * - Vibe / travel style
   * - Budget range
   * - Preferred amenities
   * - Destination / region
   * - Minimum rating threshold
   */
  async getPreferenceRecommendations(preferences = {}, limit = 12) {
    const {
      vibe,
      region = 'all',
      minPrice,
      maxPrice,
      minRating,
      amenities = [],
      city,
      userLng,
      userLat,
      radius,
    } = preferences;

    const parsedRadius =
      radius !== undefined && radius !== '' && !isNaN(Number(radius)) && Number(radius) > 0
        ? Number(radius)
        : null;

    const parsedMinPrice = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;
    const parsedMinRating = minRating !== undefined && minRating !== '' ? Number(minRating) : null;

    let normalizedAmenities = [];
    if (Array.isArray(amenities)) {
      normalizedAmenities = amenities.filter(Boolean);
    } else if (typeof amenities === 'string' && amenities.trim()) {
      normalizedAmenities = amenities.split(',').map((a) => a.trim()).filter(Boolean);
    }

    // Semantic keywords mapping for travel vibes
    const vibeKeywords = {
      beach: ['beach', 'beachfront', 'ocean', 'coastal', 'sea', 'sand', 'snorkeling', 'surf', 'waterfront', 'plunge pool', 'sundeck', 'cabana', 'coral'],
      mountain: ['mountain', 'alpine', 'pine', 'forest', 'cabin', 'hot tub', 'fireplace', 'snow', 'glacier', 'chalet', 'ski', 'himalayan', 'altitude', 'peak'],
      heritage: ['heritage', 'haveli', 'palace', 'historic', 'fort', 'temple', 'architecture', 'traditional', 'stone', '18th-century', 'carved', 'marble', 'restored', 'vineyard', 'charminar', 'warangal'],
      city: ['city', 'loft', 'skyline', 'downtown', 'penthouse', 'urban', 'modern', 'hitec', 'studio', 'elevator', 'high-floor', 'terrace', 'hyderabad'],
      lake: ['lake', 'lakeside', 'river', 'water', 'houseboat', 'backwaters', 'sanctuary', 'dam', 'boat', 'lagoon', 'ravine', 'canal', 'pakhal', 'kerala'],
      wellness: ['wellness', 'yoga', 'ashram', 'retreat', 'spiritual', 'meditation', 'spa', 'ayurvedic', 'tranquil', 'peaceful', 'frangipani', 'organic', 'rishikesh', 'bali'],
      workcation: ['wifi', 'workspace', 'fibre', 'internet', 'dedicated workspace', 'desk', 'high-speed', 'remote work', 'quiet'],
      luxury: ['luxury', 'villa', 'infinity', 'penthouse', 'palace', 'private pool', 'suite', 'chef', 'safari', 'glamping'],
    };

    const vibeLabels = {
      beach: 'Beach & Coastal',
      mountain: 'Mountain & Alpine',
      heritage: 'Heritage & Culture',
      city: 'City & Urban',
      lake: 'Lakeside & Waterways',
      wellness: 'Wellness & Spiritual',
      workcation: 'Workcation & Remote Work',
      luxury: 'Ultra Luxury & Villas',
    };

    // Fetch all properties to score
    const properties = await Property.find({}).populate('host', 'name email');

    const scoredProperties = [];

    for (const prop of properties) {
      let priceScore = 25;
      let vibeScore = 20;
      let amenityScore = 20;
      let regionScore = 10;
      let ratingScore = 8;
      const matchReasons = [];
      const matchedAmenities = [];

      // 1. Filter by Region if strict
      const propCountryLower = (prop.country || '').toLowerCase();
      const propCityLower = (prop.city || '').toLowerCase();

      if (region === 'india') {
        if (propCountryLower !== 'india') continue; // Skip non-India if user strictly chose India
        regionScore = 10;
        matchReasons.push(`Located in India (${prop.city})`);
      } else if (region === 'international') {
        if (propCountryLower === 'india') continue; // Skip India if international chosen
        regionScore = 10;
        matchReasons.push(`International getaway (${prop.country})`);
      } else if (city && city.trim()) {
        const targetCity = city.trim().toLowerCase();
        if (propCityLower.includes(targetCity) || propCountryLower.includes(targetCity)) {
          regionScore = 10;
          matchReasons.push(`In your requested destination: ${prop.city}`);
        } else {
          regionScore = 3;
        }
      }

      // 2. Filter by Minimum Rating if strict
      if (parsedMinRating !== null && parsedMinRating > 0) {
        if (prop.averageRating < parsedMinRating) continue; // Skip if below required rating
        ratingScore = 10;
        matchReasons.push(`Meets your ${parsedMinRating}★+ rating requirement (${prop.averageRating.toFixed(1)}★)`);
      } else {
        if (prop.averageRating >= 4.7) {
          ratingScore = 10;
          matchReasons.push(`Exceptional ${prop.averageRating.toFixed(1)}★ Guest Rating`);
        } else if (prop.averageRating >= 4.0) {
          ratingScore = 7;
        } else {
          ratingScore = 5;
        }
      }

      // 3. Price scoring
      const price = prop.pricePerNight;
      if (parsedMinPrice !== null || parsedMaxPrice !== null) {
        const floor = parsedMinPrice !== null ? parsedMinPrice : 0;
        const ceil = parsedMaxPrice !== null ? parsedMaxPrice : Infinity;

        if (price >= floor && price <= ceil) {
          priceScore = 30;
          matchReasons.push(`Fits your budget (₹${price.toLocaleString('en-IN')}/${prop.priceUnit || 'night'})`);
        } else if (price < floor && price >= floor * 0.75) {
          priceScore = 24;
          matchReasons.push(`Below budget: Great savings at ₹${price.toLocaleString('en-IN')}`);
        } else if (price > ceil && price <= ceil * 1.3) {
          priceScore = 18;
          matchReasons.push(`Slightly above budget: ₹${price.toLocaleString('en-IN')}`);
        } else {
          priceScore = 5;
        }
      } else {
        priceScore = 25;
      }

      // 4. Vibe scoring
      if (vibe && vibeKeywords[vibe]) {
        const keywords = vibeKeywords[vibe];
        const searchText = `${prop.title} ${prop.description} ${prop.city} ${prop.country} ${(prop.amenities || []).join(' ')}`.toLowerCase();

        let hitCount = 0;
        for (const kw of keywords) {
          if (searchText.includes(kw)) hitCount++;
        }

        if (hitCount >= 2) {
          vibeScore = 25;
          matchReasons.push(`Matches your ${vibeLabels[vibe] || vibe} style`);
        } else if (hitCount === 1) {
          vibeScore = 18;
          matchReasons.push(`Features ${vibeLabels[vibe] || vibe} atmosphere`);
        } else {
          vibeScore = 6;
        }
      } else {
        vibeScore = 20;
      }

      // 5. Amenities scoring
      if (normalizedAmenities.length > 0) {
        const propAmenitiesLower = (prop.amenities || []).map((a) => a.toLowerCase());

        for (const preferred of normalizedAmenities) {
          const prefLower = preferred.toLowerCase();
          const found = propAmenitiesLower.some((a) => a.includes(prefLower) || prefLower.includes(a));
          if (found) {
            matchedAmenities.push(preferred);
          }
        }

        const matchRatio = matchedAmenities.length / normalizedAmenities.length;
        amenityScore = Math.round(matchRatio * 25);

        if (matchedAmenities.length === normalizedAmenities.length) {
          matchReasons.push(`Has all ${normalizedAmenities.length} of your requested amenities`);
        } else if (matchedAmenities.length > 0) {
          matchReasons.push(`Includes ${matchedAmenities.slice(0, 3).join(', ')}${matchedAmenities.length > 3 ? ` +${matchedAmenities.length - 3}` : ''}`);
        }
      } else {
        amenityScore = 20;
      }

      // 6. Proximity / Distance calculation (if traveler provided coordinates)
      let distanceKm = null;
      let proximityScore = 0;
      const hasCoords =
        userLat !== null &&
        userLat !== undefined &&
        userLng !== null &&
        userLng !== undefined &&
        !isNaN(Number(userLat)) &&
        !isNaN(Number(userLng));

      if (
        hasCoords &&
        prop.location &&
        Array.isArray(prop.location.coordinates) &&
        prop.location.coordinates.length === 2
      ) {
        const [propLng, propLat] = prop.location.coordinates;
        if (!isNaN(propLng) && !isNaN(propLat)) {
          distanceKm = calculateHaversineDistanceKm(
            Number(userLat),
            Number(userLng),
            Number(propLat),
            Number(propLng)
          );

          // Radius filter: Skip properties exceeding traveler's radius distance
          if (parsedRadius !== null && distanceKm > parsedRadius) {
            continue;
          }

          if (parsedRadius !== null) {
            matchReasons.unshift(`Within your ${parsedRadius} km radius (${distanceKm < 1 ? Math.round(distanceKm * 1000) + ' m' : distanceKm.toFixed(1) + ' km'} away)`);
            proximityScore = 18;
          } else if (distanceKm <= 50) {
            proximityScore = 15;
            matchReasons.unshift(`Near your location: ${distanceKm < 1 ? Math.round(distanceKm * 1000) + ' m' : distanceKm.toFixed(1) + ' km'} away`);
          } else if (distanceKm <= 200) {
            proximityScore = 10;
            matchReasons.push(`${distanceKm.toFixed(0)} km from your coordinates`);
          } else {
            proximityScore = 5;
            matchReasons.push(`${distanceKm.toFixed(0)} km from your coordinates`);
          }
        }
      } else if (hasCoords && parsedRadius !== null) {
        // Skip properties without valid coordinates if radius filtering is strictly requested
        continue;
      }

      // Calculate overall composite match percentage (0 - 99%)
      const totalRaw = priceScore + vibeScore + amenityScore + regionScore + ratingScore + proximityScore;
      const matchPercentage = Math.min(99, Math.max(35, Math.round(totalRaw)));

      let matchGrade = 'Good Match';
      let matchBadge = 'badge-good';
      if (matchPercentage >= 90) {
        matchGrade = 'Exceptional Match';
        matchBadge = 'badge-exceptional';
      } else if (matchPercentage >= 78) {
        matchGrade = 'Great Match';
        matchBadge = 'badge-great';
      }

      scoredProperties.push({
        property: prop,
        matchPercentage,
        matchGrade,
        matchBadge,
        matchReasons,
        matchedAmenities,
        distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(1)) : null,
        scores: {
          price: priceScore,
          vibe: vibeScore,
          amenities: amenityScore,
          region: regionScore,
          rating: ratingScore,
          proximity: proximityScore,
        },
      });
    }

    // Sort descending: if user provided GPS coordinates, prioritize proximity among high matches
    scoredProperties.sort((a, b) => {
      const hasCoords = userLat !== null && userLat !== undefined && !isNaN(Number(userLat));
      if (hasCoords && a.distanceKm !== null && b.distanceKm !== null) {
        // If match percentages are close (within 10%), sort by distance (closest first)
        if (Math.abs(b.matchPercentage - a.matchPercentage) <= 10) {
          return a.distanceKm - b.distanceKm;
        }
      }
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      if (b.property.averageRating !== a.property.averageRating) {
        return b.property.averageRating - a.property.averageRating;
      }
      return b.property.reviewCount - a.property.reviewCount;
    });

    return scoredProperties.slice(0, limit);
  }
}

module.exports = new PropertyService();
