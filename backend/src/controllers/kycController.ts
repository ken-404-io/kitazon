import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import db from '../../config/database';
import { DbUser, KycStatus } from '../types';
import { logAudit } from '../services/audit';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VALID_ID_TYPES = ['national_id', 'passport', 'drivers_license', 'umid', 'voters_id', 'prc_id', 'philsys'];

async function uploadToCloudinary(dataUrl: string, folder: string, publicId: string): Promise<string> {
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `kyc/${folder}`,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
  });
  return result.secure_url;
}

// ── User: get KYC status ──────────────────────────────────────────────────────
export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users')
      .where({ id: req.user!.id })
      .select('kyc_status', 'kyc_submitted_at', 'kyc_reviewed_at', 'kyc_rejection_reason')
      .first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const submission = await db('kyc_submissions')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .first();

    res.json({
      kyc_status: user.kyc_status ?? 'none',
      kyc_submitted_at: user.kyc_submitted_at,
      kyc_reviewed_at: user.kyc_reviewed_at,
      kyc_rejection_reason: user.kyc_rejection_reason,
      submission: submission ?? null,
    });
  } catch (err) { next(err); }
}

// ── User: submit KYC ──────────────────────────────────────────────────────────
export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const status = (user.kyc_status ?? 'none') as KycStatus;
    if (status === 'approved') {
      res.status(409).json({ message: 'Your identity has already been verified.' });
      return;
    }
    if (status === 'pending') {
      res.status(409).json({ message: 'Your KYC is already under review. Please wait for approval.' });
      return;
    }

    const {
      full_name, date_of_birth, nationality, id_type, id_number,
      address, city, province, id_front_data, id_back_data, selfie_data,
    } = req.body as {
      full_name: string; date_of_birth: string; nationality: string;
      id_type: string; id_number: string; address: string; city: string; province: string;
      id_front_data?: string; id_back_data?: string; selfie_data?: string;
    };

    if (!full_name?.trim() || full_name.trim().length < 3) {
      res.status(400).json({ message: 'Full legal name is required.' }); return;
    }
    if (!date_of_birth || isNaN(Date.parse(date_of_birth))) {
      res.status(400).json({ message: 'Valid date of birth is required.' }); return;
    }
    const dob = new Date(date_of_birth);
    const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageYears < 18) {
      res.status(400).json({ message: 'You must be at least 18 years old to use Kitazon.' }); return;
    }
    if (!nationality?.trim()) {
      res.status(400).json({ message: 'Nationality is required.' }); return;
    }
    if (!VALID_ID_TYPES.includes(id_type)) {
      res.status(400).json({ message: 'Invalid ID type.' }); return;
    }
    if (!id_number?.trim() || id_number.trim().length < 4) {
      res.status(400).json({ message: 'ID number is required.' }); return;
    }
    if (!address?.trim()) {
      res.status(400).json({ message: 'Address is required.' }); return;
    }
    if (!city?.trim()) {
      res.status(400).json({ message: 'City is required.' }); return;
    }
    if (!province?.trim()) {
      res.status(400).json({ message: 'Province is required.' }); return;
    }

    // ── Upload images to Cloudinary ───────────────────────────────────────────
    const uid = String(req.user!.id);
    const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
      id_front_data ? uploadToCloudinary(id_front_data, 'id_front', uid) : Promise.resolve(null),
      id_back_data  ? uploadToCloudinary(id_back_data,  'id_back',  uid) : Promise.resolve(null),
      selfie_data   ? uploadToCloudinary(selfie_data,   'selfie',   uid) : Promise.resolve(null),
    ]);

    // ── Duplicate detection ───────────────────────────────────────────────────
    const tags: string[] = [];

    const dupId = await db('kyc_submissions')
      .where({ id_type, id_number: id_number.trim() })
      .whereNot({ user_id: req.user!.id })
      .first();
    if (dupId) tags.push('duplicate_id');

    const dupPerson = await db('kyc_submissions')
      .whereRaw('LOWER(full_name) = LOWER(?)', [full_name.trim()])
      .where({ date_of_birth })
      .whereNot({ user_id: req.user!.id })
      .first();
    if (dupPerson && !tags.includes('duplicate_id')) tags.push('possible_duplicate_person');

    // ── Persist ───────────────────────────────────────────────────────────────
    await db.transaction(async (trx) => {
      await trx('kyc_submissions').insert({
        user_id: req.user!.id,
        full_name: full_name.trim(),
        date_of_birth,
        nationality: nationality.trim(),
        id_type,
        id_number: id_number.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim(),
        id_front_data: idFrontUrl,
        id_back_data:  idBackUrl,
        selfie_data:   selfieUrl,
        tags: JSON.stringify(tags),
        status: 'pending',
      });

      await trx('users').where({ id: req.user!.id }).update({
        kyc_status: 'pending',
        kyc_submitted_at: new Date(),
        kyc_rejection_reason: null,
      });
    });

    await logAudit(req.user!.id, 'kyc_submit', req, {});
    res.status(201).json({ message: 'KYC submitted successfully. We will review your details within 24–48 hours.' });
  } catch (err) { next(err); }
}

// ── Admin: list KYC submissions ───────────────────────────────────────────────
export async function adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const rows = await db('kyc_submissions as k')
      .join('users as u', 'u.id', 'k.user_id')
      .where('k.status', status)
      .orderBy('k.created_at', 'asc')
      .select(
        'k.id', 'k.user_id', 'k.full_name', 'k.date_of_birth', 'k.nationality',
        'k.id_type', 'k.id_number', 'k.address', 'k.city', 'k.province',
        'k.status', 'k.rejection_reason', 'k.created_at', 'k.tags',
        'k.id_front_data', 'k.id_back_data', 'k.selfie_data',
        'u.name as user_name', 'u.email as user_email'
      );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Admin: approve KYC ────────────────────────────────────────────────────────
export async function adminApprove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const sub = await db('kyc_submissions').where({ id: submissionId }).first();
    if (!sub) { res.status(404).json({ message: 'Submission not found.' }); return; }

    await db.transaction(async (trx) => {
      await trx('kyc_submissions').where({ id: submissionId }).update({
        status: 'approved',
        reviewed_by: req.user!.id,
        updated_at: new Date(),
      });
      await trx('users').where({ id: sub.user_id }).update({
        kyc_status: 'approved',
        kyc_reviewed_at: new Date(),
        kyc_rejection_reason: null,
      });
    });

    await logAudit(req.user!.id, 'kyc_approve', req, { metadata: { target_user: sub.user_id } });
    res.json({ message: 'KYC approved.' });
  } catch (err) { next(err); }
}

// ── Admin: reject KYC ────────────────────────────────────────────────────────
export async function adminReject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) {
      res.status(400).json({ message: 'Rejection reason is required.' }); return;
    }

    const sub = await db('kyc_submissions').where({ id: submissionId }).first();
    if (!sub) { res.status(404).json({ message: 'Submission not found.' }); return; }

    await db.transaction(async (trx) => {
      await trx('kyc_submissions').where({ id: submissionId }).update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        reviewed_by: req.user!.id,
        updated_at: new Date(),
      });
      await trx('users').where({ id: sub.user_id }).update({
        kyc_status: 'rejected',
        kyc_reviewed_at: new Date(),
        kyc_rejection_reason: reason.trim(),
      });
    });

    await logAudit(req.user!.id, 'kyc_reject', req, { metadata: { target_user: sub.user_id, reason } });
    res.json({ message: 'KYC rejected.' });
  } catch (err) { next(err); }
}
