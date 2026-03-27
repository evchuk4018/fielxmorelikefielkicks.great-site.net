import React from 'react';
import { AUTON_FIELD_HEIGHT, AUTON_FIELD_OVERLAY_SRC, AUTON_FIELD_WIDTH } from '../constants';
import { RawMatchPoint } from '../types';

type TeleopShotFieldProps = {
  points: RawMatchPoint[];
  emptyMessage?: string;
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

export const TeleopShotField = React.memo(function TeleopShotField({
  points,
  emptyMessage = 'No teleop shots captured for this match.',
}: TeleopShotFieldProps) {
  const hasPoints = points.length > 0;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${AUTON_FIELD_WIDTH} ${AUTON_FIELD_HEIGHT}`}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/70"
      >
        <image
          href={AUTON_FIELD_OVERLAY_SRC}
          x="0"
          y="0"
          width={AUTON_FIELD_WIDTH}
          height={AUTON_FIELD_HEIGHT}
          preserveAspectRatio="none"
          opacity="0.95"
        />

        {points.map((point, index) => {
          const x = clamp01(point.x) * AUTON_FIELD_WIDTH;
          const y = clamp01(point.y) * AUTON_FIELD_HEIGHT;

          return (
            <g key={`teleop-shot-${point.timestampMs}-${index}`}>
              <circle cx={x} cy={y} r={9} fill="#22c55e" stroke="#14532d" strokeWidth="2" />
              <circle cx={x} cy={y} r={3} fill="#ecfdf5" />
            </g>
          );
        })}
      </svg>

      {!hasPoints && <p className="text-xs text-slate-500">{emptyMessage}</p>}
    </div>
  );
});

TeleopShotField.displayName = 'TeleopShotField';