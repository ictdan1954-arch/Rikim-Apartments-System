class ApiResponse {
    static success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    }

    static created(res, data = null, message = 'Created successfully') {
        return this.success(res, data, message, 201);
    }

    static error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors
        });
    }

    static badRequest(res, message = 'Bad request', errors = null) {
        return this.error(res, message, 400, errors);
    }

    static unauthorized(res, message = 'Unauthorized access') {
        return this.error(res, message, 401);
    }

    static forbidden(res, message = 'Forbidden - Insufficient permissions') {
        return this.error(res, message, 403);
    }

    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404);
    }

    static paginated(res, data, total, page, limit, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    }
}

module.exports = ApiResponse;
