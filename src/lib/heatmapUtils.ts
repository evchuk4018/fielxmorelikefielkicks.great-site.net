export type HeatmapPoint = {
  x: number;
  y: number;
};

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
