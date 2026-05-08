import { Request, Response, NextFunction } from 'express';

function clean(value: unknown): unknown {
  if (typeof value === 'string') return value
    .trim()
    .replace(/[<>]/g, '')           // strip HTML tag delimiters
    .replace(/\0/g, '')             // strip null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); // strip other control chars
  if (Array.isArray(value)) return value.map(clean);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, clean(v)])
    );
  }
  return value;
}

export default function sanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = clean(req.body);
  next();
}
