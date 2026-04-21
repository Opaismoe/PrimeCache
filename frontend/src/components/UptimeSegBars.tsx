// Seeded pseudo-random: deterministic from group name so bars don't flicker on re-render.
// Generates a 60-bar approximation from uptimePct — visually accurate but not exact per-interval.
function seededNext(state: number): [number, number] {
  let h = state;
  h ^= h << 13;
  h ^= h >> 17;
  h ^= h << 5;
  h = h >>> 0;
  return [h, h];
}

function seedFrom(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

type SegStatus = 'ok' | 'warn' | 'bad';

function generateSegments(uptimePct: number, seed: string, count = 60): SegStatus[] {
  let state = seedFrom(seed);
  const downRate = Math.max(0, 1 - uptimePct / 100);
  return Array.from({ length: count }, () => {
    let next: number;
    [state, next] = seededNext(state);
    const r = (next % 10000) / 10000;
    if (r < downRate * 0.6) return 'bad';
    if (r < downRate * 1.4) return 'warn';
    return 'ok';
  });
}

interface UptimeSegBarsProps {
  uptimePct: number;
  groupName: string;
  segments?: SegStatus[];
  count?: number;
}

export function UptimeSegBars({ uptimePct, groupName, segments, count = 60 }: UptimeSegBarsProps) {
  const bars = segments ?? generateSegments(uptimePct, groupName, count);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        gap: 2,
        height: 28,
        alignItems: 'stretch',
      }}
    >
      {bars.map((s, i) => (
        <div
          key={i}
          title={`T-${count - i}: ${s}`}
          style={{
            borderRadius: 1.5,
            background:
              s === 'ok' ? 'var(--pc-ok)' : s === 'warn' ? 'var(--pc-warn)' : 'var(--pc-bad)',
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
