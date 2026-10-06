/**
 * Input validation helpers for StayVerse
 */

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim());
};

const validateRegisterInput = ({ name, email, password, role }) => {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required');
  } else if (name.trim().length > 50) {
    errors.push('Name cannot exceed 50 characters');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (role && !['traveler', 'host'].includes(role)) {
    errors.push('Role must be either "traveler" or "host"');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateLoginInput = ({ email, password }) => {
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('Please enter a valid email address');
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  isValidEmail,
  validateRegisterInput,
  validateLoginInput,
};
