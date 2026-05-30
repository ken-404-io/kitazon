import db from '../../config/database';

// Insert an in-app notification (best-effort — never throws into the caller).
export async function createNotification(
  userId: number, type: string, title: string, message: string,
): Promise<void> {
  try {
    const now = new Date();
    await db('notifications').insert({
      user_id: userId,
      type: type.slice(0, 50),
      title: title.slice(0, 200),
      message,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    console.error('[notify] failed to create notification:', err);
  }
}

// Notify every admin user (in-app). Best-effort.
export async function notifyAdmins(type: string, title: string, message: string): Promise<void> {
  try {
    const admins = await db('users').where({ is_admin: true, is_active: true }).select('id');
    if (admins.length === 0) return;
    const now = new Date();
    await db('notifications').insert(
      admins.map((a: { id: number }) => ({
        user_id: a.id, type: type.slice(0, 50), title: title.slice(0, 200), message, created_at: now, updated_at: now,
      })),
    );
  } catch (err) {
    console.error('[notify] failed to notify admins:', err);
  }
}
