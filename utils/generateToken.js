const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for an authenticated user
 * @param {string} id - User ID
 * @param {string} role - User role ('traveler' | 'host')
 * @returns {string} Signed JWT token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'stayverse_default_dev_jwt_secret',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

/**
 * Send token in response (as HTTP-only cookie and JSON/Redirect depending on client)
 */
const sendTokenResponse = (user, statusCode, req, res, redirectUrl = '/') => {
  const token = generateToken(user._id, user.role);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res.cookie('token', token, cookieOptions);

  const isApiRequest =
    req.originalUrl.startsWith('/api') ||
    req.xhr ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  // Browser redirect with welcome flash
  res.cookie('successMsg', `Welcome, ${user.name}!`, { maxAge: 5000 });
  return res.redirect(redirectUrl);
};

module.exports = {
  generateToken,
  sendTokenResponse,
};
