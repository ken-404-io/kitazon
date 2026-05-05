import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  status?: number;
}

export default function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(err.status ?? 500).json({ message: err.message ?? 'Internal server error' });
}
