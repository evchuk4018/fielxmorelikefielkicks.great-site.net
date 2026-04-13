import React from 'react';

type FieldHeatmapProps = {
  points: Array<{ x: number; y: number }>;
  totalShots?: number;
  color?: string;
  overlaySrc?: string;
  width?: number;
  height?: number;
  showHorizontalThirds?: boolean;
  emptyMessage?: string;
  pointRadius?: number;
  overlapBucketPx?: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export const FieldHeatmap = React.memo(function FieldHeatmap({
  points,
  totalShots,
  color = '#f43f5e',
  overlaySrc = '/auton-field-overlay.svg',
  width = 1000,
  height = 540,
  showHorizontalThirds = false,
  emptyMessage = 'No shot attempts captured yet.',
  pointRadius = 8,
  overlapBucketPx = 14,
}: FieldHeatmapProps) {
  const normalizedPoints = points.map((point) => {
    return {
      x: clamp01(point.x),
      y: clamp01(point.y),
    };
  });

  const densityByBucket = new Map<string, number>();
  normalizedPoints.forEach((point) => {
    const x = point.x * width;
    const y = point.y * height;
    const bucketX = Math.round(x / overlapBucketPx);
    const bucketY = Math.round(y / overlapBucketPx);
    const key = `${bucketX}:${bucketY}`;
    densityByBucket.set(key, (densityByBucket.get(key) || 0) + 1);
  });

  const resolvedTotalShots = typeof totalShots === 'number' ? totalShots : normalizedPoints.length;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg border border-slate-700 bg-slate-950/70">
        <image
          href={overlaySrc}
          x="0"
          y="0"
          width={width}
          height={height}
          preserveAspectRatio="none"
          opacity="0.95"
        />

        {showHorizontalThirds && (
          <>
            <line
              x1="0"
              y1={height / 3}
              x2={width}
              y2={height / 3}
              stroke="#64748b"
              strokeDasharray="8 6"
              strokeWidth="1"
              opacity="0.7"
            />
            <line
              x1="0"
              y1={(height * 2) / 3}
              x2={width}
              y2={(height * 2) / 3}
              stroke="#64748b"
              strokeDasharray="8 6"
              strokeWidth="1"
              opacity="0.7"
            />
          </>
        )}

        {normalizedPoints.map((point, index) => {
          const x = point.x * width;
          const y = point.y * height;
          const bucketX = Math.round(x / overlapBucketPx);
          const bucketY = Math.round(y / overlapBucketPx);
          const key = `${bucketX}:${bucketY}`;
          const overlapCount = densityByBucket.get(key) || 1;

          const opacity = Math.min(0.92, 0.22 + (overlapCount - 1) * 0.18);

          return (
            <g key={`shot-${index}-${bucketX}-${bucketY}`}>
              <circle cx={x} cy={y} r={pointRadius} fill={color} opacity={opacity} />
              <circle cx={x} cy={y} r={Math.max(2, pointRadius * 0.32)} fill="#f8fafc" opacity={0.55} />
            </g>
          );
        })}
      </svg>

      {resolvedTotalShots === 0 && <p className="text-xs text-slate-500">{emptyMessage}</p>}
    </div>
  );
});

FieldHeatmap.displayName = 'FieldHeatmap';
