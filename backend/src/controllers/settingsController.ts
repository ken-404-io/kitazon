import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import db from '../../config/database';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface SettingRow { key: string; value: string; }

let cache: Record<string, string> | null = null;
let cacheAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function getAllSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cacheAt < CACHE_TTL) return cache;
  const rows = await db<SettingRow>('site_settings').select('key', 'value');
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value;
  cache = result;
  cacheAt = Date.now();
  return result;
}

export function invalidateCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function getPublicSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await getAllSettings());
  } catch (err) { next(err); }
}

export async function adminUpdateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updates = req.body as Record<string, string>;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ message: 'Body must be a flat key/value object.' });
      return;
    }
    const entries = Object.entries(updates);
    if (entries.length === 0) {
      res.status(400).json({ message: 'No settings provided.' });
      return;
    }
    for (const [key, value] of entries) {
      await db('site_settings')
        .insert({ key, value: String(value), updated_at: new Date() })
        .onConflict('key')
        .merge({ value: String(value), updated_at: new Date() });
    }
    invalidateCache();
    res.json({ message: 'Settings updated.' });
  } catch (err) { next(err); }
}

export async function adminUploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { image_data } = req.body as { image_data?: string };
    if (!image_data || typeof image_data !== 'string' || !image_data.startsWith('data:image/')) {
      res.status(400).json({ message: 'A valid image data URL is required.' });
      return;
    }
    const result = await cloudinary.uploader.upload(image_data, {
      folder: 'promo',
      resource_type: 'image',
    });
    res.json({ url: result.secure_url });
  } catch (err) { next(err); }
}
