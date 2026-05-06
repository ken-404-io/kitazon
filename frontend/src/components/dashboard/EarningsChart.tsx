import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Skeleton } from '../ui/Skeleton';

interface DayEarning {
  date: string;
  total: number;
}

export default function EarningsChart() {
  const [data, setData] = useState<DayEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DayEarning[]>('/tasks/earnings/chart')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton height={160} borderRadius={8} />;
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 480;
  const H = 140;
  const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1 || 1)) * chartW,
    y: PAD.top + chartH - (d.total / max) * chartH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left},${(PAD.top + chartH).toFixed(1)} Z`;

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: 16 }}>Earnings — Last 7 Days</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Y grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + chartH - t * chartH;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#333" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize={10}>
                ₱{(t * max).toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="rgba(245,158,11,0.15)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />

        {/* Dots + labels */}
        {points.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r={4} fill="#f59e0b" />
            <text x={p.x} y={PAD.top + chartH + 16} textAnchor="middle" fill="#9ca3af" fontSize={9}>
              {new Date(p.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
