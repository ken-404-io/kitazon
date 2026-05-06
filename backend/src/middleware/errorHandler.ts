import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  status?: number;
}

const isDev = process.env.NODE_ENV === 'development';

export default function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.status ?? 500;

  if (isDev) {
    console.error(err);
  } else {
    // Only log message and status in production — no stack traces
    console.error(`[${new Date().toISOString()}] ${status} ${err.message}`);
  }

  // Never expose stack traces or internal error details to clients
  const message = status < 500
    ? (err.message ?? 'Bad request.')
    : 'Internal server error.';

  res.status(status).json({ message });
}
