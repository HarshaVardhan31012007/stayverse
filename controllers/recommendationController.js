const propertyService = require('../services/propertyService');
const User = require('../models/User');

/**
 * Recommendation Controller
 * Handles personalized recommendations based on traveler preferences
 */

// Parse preferences from query, user profile, or cookie
const getActivePreferences = (req) => {
  const query = req.query || {};

  // Check if any query param was actively supplied
  const hasQueryPreferences =
    query.vibe !== undefined ||
    query.region !== undefined ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.minRating !== undefined ||
    query.amenities !== undefined ||
    query.city !== undefined ||
    query.userLat !== undefined ||
    query.userLng !== undefined ||
    query.radius !== undefined;

  if (hasQueryPreferences) {
    let amenitiesList = [];
    if (Array.isArray(query.amenities)) {
      amenitiesList = query.amenities;
    } else if (typeof query.amenities === 'string' && query.amenities.trim()) {
      amenitiesList = query.amenities.split(',').map((a) => a.trim()).filter(Boolean);
    }

    const parsedLat = query.userLat !== undefined && query.userLat !== '' ? parseFloat(query.userLat) : null;
    const parsedLng = query.userLng !== undefined && query.userLng !== '' ? parseFloat(query.userLng) : null;
    const parsedRadius =
      query.radius !== undefined && query.radius !== '' && !isNaN(Number(query.radius))
        ? Number(query.radius)
        : null;

    return {
      vibe: query.vibe || '',
      region: query.region || 'all',
      minPrice: query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : 0,
      maxPrice: query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : 30000,
      minRating: query.minRating !== undefined && query.minRating !== '' ? Number(query.minRating) : 0,
      amenities: amenitiesList,
      city: query.city || '',
      userLat: (parsedLat !== null && !isNaN(parsedLat)) ? parsedLat : null,
      userLng: (parsedLng !== null && !isNaN(parsedLng)) ? parsedLng : null,
      radius: (parsedRadius !== null && parsedRadius > 0) ? parsedRadius : null,
    };
  }

  // Fallback to user saved preferences if logged in
  if (req.user && req.user.preferences && (req.user.preferences.vibe || req.user.preferences.minPrice || req.user.preferences.region || req.user.preferences.radius)) {
    return {
      vibe: req.user.preferences.vibe || '',
      region: req.user.preferences.region || 'all',
      minPrice: req.user.preferences.minPrice || 0,
      maxPrice: req.user.preferences.maxPrice || 30000,
      minRating: req.user.preferences.minRating || 0,
      amenities: req.user.preferences.amenities || [],
      city: req.user.preferences.city || '',
      userLat: null,
      userLng: null,
      radius: req.user.preferences.radius || null,
    };
  }

  // Fallback to cookie preferences if set
  if (req.cookies && req.cookies.stayverse_preferences) {
    try {
      const parsed = JSON.parse(req.cookies.stayverse_preferences);
      return {
        vibe: parsed.vibe || '',
        region: parsed.region || 'all',
        minPrice: parsed.minPrice || 0,
        maxPrice: parsed.maxPrice || 30000,
        minRating: parsed.minRating || 0,
        amenities: Array.isArray(parsed.amenities) ? parsed.amenities : [],
        city: parsed.city || '',
        userLat: null,
        userLng: null,
        radius: parsed.radius ? Number(parsed.radius) : null,
      };
    } catch (e) {
      // Ignore cookie parse error
    }
  }

  // Default initial preferences
  return {
    vibe: '',
    region: 'all',
    minPrice: 0,
    maxPrice: 30000,
    minRating: 0,
    amenities: [],
    city: '',
    userLat: null,
    userLng: null,
    radius: null,
  };
};

// Render recommendations page or return JSON for AJAX live updates
const getRecommendations = async (req, res) => {
  const preferences = getActivePreferences(req);

  // Check if traveler has actively selected any custom preferences
  const hasActivePreferences = !!(
    (preferences.vibe && preferences.vibe.trim()) ||
    (preferences.city && preferences.city.trim()) ||
    (preferences.region && preferences.region !== 'all') ||
    (preferences.minPrice && Number(preferences.minPrice) > 0) ||
    (preferences.maxPrice && Number(preferences.maxPrice) < 30000) ||
    (preferences.minRating && Number(preferences.minRating) > 0) ||
    (preferences.amenities && preferences.amenities.length > 0) ||
    (preferences.userLat !== null && preferences.userLng !== null) ||
    (preferences.radius !== null && Number(preferences.radius) > 0)
  );

  const recommendations = await propertyService.getPreferenceRecommendations(preferences, 15);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.query.format === 'json' ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      hasActivePreferences,
      count: recommendations.length,
      preferences,
      data: recommendations,
    });
  }

  res.render('recommendations/index', {
    title: 'Personalized Stay Recommendations',
    recommendations,
    preferences,
    hasActivePreferences,
    savedInProfile: !!(req.user && req.user.preferences?.vibe),
  });
};

// Save traveler preferences to profile (if logged in) and cookie
const savePreferences = async (req, res) => {
  const { vibe, region, minPrice, maxPrice, minRating, amenities, city, radius } = req.body;

  let amenitiesList = [];
  if (Array.isArray(amenities)) {
    amenitiesList = amenities;
  } else if (typeof amenities === 'string' && amenities.trim()) {
    amenitiesList = amenities.split(',').map((a) => a.trim()).filter(Boolean);
  }

  const prefData = {
    vibe: vibe || '',
    region: region || 'all',
    minPrice: minPrice !== undefined && minPrice !== '' ? Number(minPrice) : 0,
    maxPrice: maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : 30000,
    minRating: minRating !== undefined && minRating !== '' ? Number(minRating) : 0,
    amenities: amenitiesList,
    city: city || '',
    radius: radius !== undefined && radius !== '' && !isNaN(Number(radius)) ? Number(radius) : 0,
  };

  // If user is logged in, save to MongoDB user profile
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, { preferences: prefData });
  }

  // Save in cookie (valid for 30 days)
  res.cookie('stayverse_preferences', JSON.stringify(prefData), {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
  });

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(200).json({
      success: true,
      message: 'Preferences saved successfully!',
      preferences: prefData,
    });
  }

  res.cookie('successMsg', 'Travel preferences saved! Your recommendations are updated.', { maxAge: 5000 });
  res.redirect('/recommendations');
};

module.exports = {
  getRecommendations,
  savePreferences,
};
