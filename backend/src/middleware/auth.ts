import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { tokenBlacklist } from '../controllers/authController';

export default function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload & { jti?: string };
    if (payload.jti && tokenBlacklist.has(payload.jti)) {
      res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
