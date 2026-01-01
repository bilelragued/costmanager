import { Request, Response, NextFunction } from 'express';

// Custom error class with status code and error code
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const errors = {
  notFound: (resource: string) => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  badRequest: (message: string) => new AppError(message, 400, 'BAD_REQUEST'),
  conflict: (message: string) => new AppError(message, 409, 'CONFLICT'),
  unauthorized: () => new AppError('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: () => new AppError('Forbidden', 403, 'FORBIDDEN'),
  internal: (message: string = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR'),
};

// SQLite error codes
const SQLITE_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  SQLITE_CONSTRAINT_UNIQUE: { status: 409, code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists' },
  SQLITE_CONSTRAINT_FOREIGNKEY: { status: 400, code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' },
  SQLITE_CONSTRAINT_NOTNULL: { status: 400, code: 'REQUIRED_FIELD', message: 'A required field is missing' },
  SQLITE_CONSTRAINT_CHECK: { status: 400, code: 'INVALID_VALUE', message: 'Value does not meet constraints' },
};

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, {
    method: req.method,
    url: req.url,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle AppError (our custom errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Handle SQLite errors
  const sqliteError = err as any;
  if (sqliteError.code && SQLITE_ERRORS[sqliteError.code]) {
    const mapped = SQLITE_ERRORS[sqliteError.code];
    return res.status(mapped.status).json({
      error: mapped.message,
      code: mapped.code,
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  }

  // Default to 500 internal server error
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    console[logLevel === 'warn' ? 'warn' : 'log'](
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
