const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

const validatePhone = (phone) => {
    const re = /^\+?[\d\s-]{10,15}$/;
    return re.test(phone);
};

const validateRequired = (obj, fields) => {
    const missing = [];
    fields.forEach(field => {
        if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
            missing.push(field);
        }
    });
    return missing;
};

const validatePassword = (password) => {
    if (password.length < 6) {
        return 'Password must be at least 6 characters';
    }
    return null;
};

module.exports = {
    validateEmail,
    validatePhone,
    validateRequired,
    validatePassword
};
