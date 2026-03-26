export type HeatmapPoint = {
  x: number;
  y: number;
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

export function normalizeHeatmapPoint(point: HeatmapPoint): HeatmapPoint {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
  };
}

export function buildHeatmapBins(points: HeatmapPoint[], cols: number, rows: number): number[] {
  const bins = Array.from({ length: cols * rows }, () => 0);

  points.forEach((point) => {
    const normalized = normalizeHeatmapPoint(point);
    const col = Math.min(cols - 1, Math.floor(normalized.x * cols));
    const row = Math.min(rows - 1, Math.floor(normalized.y * rows));
    const index = row * cols + col;
    bins[index] += 1;
  });

  return bins;
}

export function alignPointBetweenAlliances(
  point: HeatmapPoint,
  sourceAlliance: 'Red' | 'Blue' | '',
  targetAlliance: 'Red' | 'Blue' | '',
): HeatmapPoint {
  if (!sourceAlliance || !targetAlliance || sourceAlliance === targetAlliance) {
    return point;
  }

  return {
    x: 1 - point.x,
    y: 1 - point.y,
  };
}
