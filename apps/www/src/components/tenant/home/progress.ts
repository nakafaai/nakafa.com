/**
 * How far along a span of time is at an instant, from 0 to 100 percent. A span that has not begun reads 0, and a span
 * that has ended reads 100, so a bar never runs past its end. A span with no length reads 100 once its end has come.
 */
export const progressPercent = (from: number, to: number, now: number) => {
  if (to <= from) {
    return now >= to ? 100 : 0;
  }
  const share = (now - from) / (to - from);
  return Math.round(Math.min(Math.max(share, 0), 1) * 100);
};
