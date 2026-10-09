/** Linear interpolation: progress 0 gives start and progress 1 gives end. */
export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
