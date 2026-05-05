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
