export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, msg?: string, details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (msg = 'Please sign in') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Not allowed') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (what = 'Not found') => new AppError(404, 'NOT_FOUND', what);
export const conflict = (code: string, msg?: string, details?: unknown) => new AppError(409, code, msg, details);
export const tooMany = (msg = 'Too many attempts, try again later') => new AppError(429, 'RATE_LIMITED', msg);
