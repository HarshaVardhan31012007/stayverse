const Property = require('../models/Property');
const { formatUploadedImages } = require('../middleware/uploadMiddleware');

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
      sort = 'newest',
      page = 1,
      limit = 12,
    } = queryParams;

    const query = {};

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

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sort === 'price-asc') sortOptions = { pricePerNight: 1 };
    if (sort === 'price-desc') sortOptions = { pricePerNight: -1 };
    if (sort === 'rating') sortOptions = { averageRating: -1, reviewCount: -1 };
    if (sort === 'newest') sortOptions = { createdAt: -1 };

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;

    const total = await Property.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum) || 1;

    const properties = await Property.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('host', 'name email');

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
}

module.exports = new PropertyService();
