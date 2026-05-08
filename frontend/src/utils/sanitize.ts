/* ── Validators (return error string or null) ──────────────────────────────── */

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  if (name.trim().length > 100) return 'Name must be under 100 characters.';
  return null;
}

export function validateEmailField(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!isValidEmail(email.trim().toLowerCase())) return 'Enter a valid email address.';
  return null;
}

export function validatePasswordField(password: string): string | null {
  if (!password) return 'Password is required.';
  return isStrongPassword(password);
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function validatePhoneNumber(value: string): string | null {
  if (!value.trim()) return 'Mobile number is required.';
  if (!/^09\d{9}$/.test(value.trim())) return 'Enter a valid PH number (09XXXXXXXXX).';
  return null;
}

/* ── Sanitizers ────────────────────────────────────────────────────────────── */

export function sanitizeInput(value: string): string {
  return value.trim().replace(/[<>]/g, '');
}

export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
