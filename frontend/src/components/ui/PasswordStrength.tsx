interface Props { password: string; }

function score(pw: string): number {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const LABELS = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;
  const s = score(password);
  const color = COLORS[s] ?? COLORS[1];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= s ? color : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color, margin: 0 }}>{LABELS[s]}</p>
    </div>
  );
}
