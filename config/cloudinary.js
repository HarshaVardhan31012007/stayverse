const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let storage;

const isMockCloudinary =
  process.env.NODE_ENV === 'test' ||
  !process.env.CLOUDINARY_API_KEY ||
  process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud';

if (isMockCloudinary) {
  // Use memory storage for tests / development without Cloudinary API credentials
  storage = multer.memoryStorage();
} else {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'stayverse_properties',
      allowed_formats: ['jpeg', 'jpg', 'png', 'webp'],
      transformation: [{ width: 1400, height: 900, crop: 'limit' }],
    },
  });
}

module.exports = {
  cloudinary,
  storage,
  isMockCloudinary,
};
