/** Origin and start time of one ripple in grid coordinates. */
export interface Ripple {
  startTime: number;
  x: number;
  y: number;
}

const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_WIDTH = 2;

function getWaveIntensity(
  distance: number,
  radius: number,
  progress: number
): number {
  const waveHalfWidth = RIPPLE_WAVE_WIDTH / 2;
  const distanceFromWave = Math.abs(distance - radius);

  if (distanceFromWave > waveHalfWidth) {
    return 0;
  }

  const normalizedDistance = distanceFromWave / waveHalfWidth;
  return (1 - normalizedDistance ** 2) * (1 - progress);
}

/** Samples the nonzero cells of one wave without advancing animation state. */
export function sampleRippleCells({
  ripple,
  columnCount,
  rowCount,
  currentTime,
  waveDuration,
}: {
  ripple: Ripple;
  columnCount: number;
  rowCount: number;
  currentTime: number;
  waveDuration: number;
}): [number, number][] {
  const progress = (currentTime - ripple.startTime) / waveDuration;
  const radius =
    progress * Math.max(columnCount, rowCount) * RIPPLE_RADIUS_MULTIPLIER;
  const searchRadius = radius + RIPPLE_WAVE_WIDTH;
  const minRow = Math.max(0, Math.floor(ripple.y - searchRadius));
  const maxRow = Math.min(rowCount - 1, Math.ceil(ripple.y + searchRadius));
  const minCol = Math.max(0, Math.floor(ripple.x - searchRadius));
  const maxCol = Math.min(columnCount - 1, Math.ceil(ripple.x + searchRadius));
  const cells: [number, number][] = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const distance = Math.sqrt((col - ripple.x) ** 2 + (row - ripple.y) ** 2);
      const intensity = getWaveIntensity(distance, radius, progress);
      if (intensity > 0) {
        cells.push([row * columnCount + col, intensity]);
      }
    }
  }
  return cells;
}
