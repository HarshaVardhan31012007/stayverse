const multer = require('multer');
const { storage, isMockCloudinary } = require('../config/cloudinary');

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed!'), false);
    }
  },
});

/**
 * Format uploaded files into standard [{ url, filename }] image schema objects
 * @param {Array} files - req.files from multer
 * @returns {Array} Array of image objects
 */
const formatUploadedImages = (files) => {
  if (!files || files.length === 0) return [];

  return files.map((file, idx) => {
    if (file.path) {
      // Cloudinary upload returns path as the secure URL
      return {
        url: file.path,
        filename: file.filename || `stayverse-img-${Date.now()}-${idx}`,
      };
    }

    if (file.buffer) {
      // Memory storage (test / local environment)
      const base64Data = file.buffer.toString('base64');
      return {
        url: `data:${file.mimetype};base64,${base64Data}`,
        filename: file.originalname || `upload-${Date.now()}-${idx}`,
      };
    }

    return {
      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      filename: `default-${Date.now()}`,
    };
  });
};

module.exports = {
  upload,
  formatUploadedImages,
};
