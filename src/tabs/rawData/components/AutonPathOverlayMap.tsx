import React, { useMemo } from 'react';
import {
  AUTON_FIELD_HEIGHT,
  AUTON_FIELD_OVERLAY_SRC,
  AUTON_FIELD_WIDTH,
} from '../constants';
import { NormalizedPoint, StripKey } from '../types';

export const STRIP_PATH_COLORS: Record<StripKey, string> = {
  top: '#38bdf8',
  middle: '#f59e0b',
  bottom: '#f43f5e',
};

type OverlayRun = {
  key: string;
  strip: StripKey;
  trajectory: NormalizedPoint[];
};

type AutonPathOverlayMapProps = {
  runs: OverlayRun[];
  width?: number;
  height?: number;
  overlaySrc?: string;
  showHorizontalThirds?: boolean;
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

function toPolyline(points: NormalizedPoint[], width: number, height: number): string {
  return points
    .map((point) => {
      const x = clamp01(point.x) * width;
      const y = clamp01(point.y) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function resolveLineOpacity(runCount: number): number {
  if (runCount <= 8) {
    return 0.34;
  }

  if (runCount <= 20) {
    return 0.24;
  }

  if (runCount <= 45) {
    return 0.16;
  }

  return 0.1;
}

function resolveStrokeWidth(runCount: number): number {
  if (runCount >= 70) {
    return 2.25;
  }

  if (runCount >= 35) {
    return 2.6;
  }

  return 3;
}

export const AutonPathOverlayMap = React.memo(function AutonPathOverlayMap({
  runs,
  width = AUTON_FIELD_WIDTH,
  height = AUTON_FIELD_HEIGHT,
  overlaySrc = AUTON_FIELD_OVERLAY_SRC,
  showHorizontalThirds = true,
  emptyMessage = 'No autonomous paths captured for the selected strip filters.',
}: AutonPathOverlayMapProps) {
  const runCount = runs.length;
  const lineOpacity = resolveLineOpacity(runCount);
  const strokeWidth = resolveStrokeWidth(runCount);

  const stripCounts = useMemo(() => {
    return runs.reduce(
      (counts, run) => {
        counts[run.strip] += 1;
        return counts;
      },
      { top: 0, middle: 0, bottom: 0 } as Record<StripKey, number>,
    );
  }, [runs]);

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950/70"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <img
          src={overlaySrc}
          alt="Field overlay"
          className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-65"
        />

        <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full">
          {showHorizontalThirds && (
            <g>
              <line
                x1="0"
                y1={height / 3}
                x2={width}
                y2={height / 3}
                stroke="rgba(148, 163, 184, 0.8)"
                strokeWidth="1.5"
                strokeDasharray="8 7"
              />
              <line
                x1="0"
                y1={(height * 2) / 3}
                x2={width}
                y2={(height * 2) / 3}
                stroke="rgba(148, 163, 184, 0.8)"
                strokeWidth="1.5"
                strokeDasharray="8 7"
              />
            </g>
          )}

          {runs.map((run) => {
            if (run.trajectory.length < 2) {
              return null;
            }

            return (
              <polyline
                key={run.key}
                fill="none"
                points={toPolyline(run.trajectory, width, height)}
                stroke={STRIP_PATH_COLORS[run.strip]}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={lineOpacity}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700">Runs Drawn: {runCount}</span>
        <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700" style={{ borderColor: STRIP_PATH_COLORS.top }}>
          Top: {stripCounts.top}
        </span>
        <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700" style={{ borderColor: STRIP_PATH_COLORS.middle }}>
          Middle: {stripCounts.middle}
        </span>
        <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700" style={{ borderColor: STRIP_PATH_COLORS.bottom }}>
          Bottom: {stripCounts.bottom}
        </span>
      </div>

      {runCount === 0 && <p className="text-xs text-slate-500">{emptyMessage}</p>}
    </div>
  );
});

AutonPathOverlayMap.displayName = 'AutonPathOverlayMap';
