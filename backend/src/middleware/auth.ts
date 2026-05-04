import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthPayload } from '../types';

export default function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
