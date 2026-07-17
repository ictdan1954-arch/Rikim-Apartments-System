const ApiResponse = require('../utils/response');

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return ApiResponse.unauthorized(res, 'Not authenticated');
        }

        if (!roles.includes(req.user.role)) {
            return ApiResponse.forbidden(res, 'You do not have permission to perform this action');
        }

        next();
    };
};

module.exports = authorize;
