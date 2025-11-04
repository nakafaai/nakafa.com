/**
 * Standard HTTP Status Codes
 * Use these constants instead of magic numbers in your route handlers.
 */

// Success codes
export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_ACCEPTED = 202;
export const HTTP_NO_CONTENT = 204;

// Client error codes
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_METHOD_NOT_ALLOWED = 405;
export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE_ENTITY = 422;

// Server error codes
export const HTTP_INTERNAL_ERROR = 500;
export const HTTP_NOT_IMPLEMENTED = 501;
export const HTTP_SERVICE_UNAVAILABLE = 503;
