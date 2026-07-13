/** Marker geometries used to distinguish point-based chart series without color. */
export type ChartDotVariant =
  | "default"
  | "border"
  | "colored-border"
  | "square"
  | "square-border"
  | "diamond"
  | "diamond-border"
  | "triangle"
  | "triangle-border";

/** A line cue shared by the plotted series and its legend indicator. */
export interface ChartLineSeriesCue {
  activeDot: ChartDotVariant;
  dot: ChartDotVariant;
  kind: "line";
  strokeDasharray?: string;
}

/** A point cue shared by the plotted series and its legend indicator. */
export interface ChartPointSeriesCue {
  activeDot: ChartDotVariant;
  dot: ChartDotVariant;
  kind: "point";
}

/** A bar cue shared by the plotted series and its legend indicator. */
export interface ChartBarSeriesCue {
  kind: "bar";
  radius: number;
  variant: "default" | "hatched";
}

/** Non-color series metadata rendered by EvilCharts legends. */
export type ChartSeriesCue =
  | ChartLineSeriesCue
  | ChartPointSeriesCue
  | ChartBarSeriesCue;

const LINE_SERIES_CUES: readonly ChartLineSeriesCue[] = [
  {
    activeDot: "colored-border",
    dot: "default",
    kind: "line",
  },
  {
    activeDot: "square-border",
    dot: "square",
    kind: "line",
    strokeDasharray: "8 4",
  },
  {
    activeDot: "diamond-border",
    dot: "diamond",
    kind: "line",
    strokeDasharray: "2 3",
  },
  {
    activeDot: "triangle-border",
    dot: "triangle",
    kind: "line",
    strokeDasharray: "10 3 2 3",
  },
];

const POINT_SERIES_CUES: readonly ChartPointSeriesCue[] = [
  { activeDot: "colored-border", dot: "default", kind: "point" },
  { activeDot: "square-border", dot: "square", kind: "point" },
  { activeDot: "diamond-border", dot: "diamond", kind: "point" },
  { activeDot: "triangle-border", dot: "triangle", kind: "point" },
];

const BAR_SERIES_CUES: readonly ChartBarSeriesCue[] = [
  { kind: "bar", radius: 0, variant: "default" },
  { kind: "bar", radius: 4, variant: "hatched" },
  { kind: "bar", radius: 12, variant: "default" },
  { kind: "bar", radius: 12, variant: "hatched" },
];

function getCyclicCue<T>(cues: readonly T[], index: number): T {
  const safeIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return cues[safeIndex % cues.length];
}

/** Returns a deterministic line cue for a zero-based series index. */
export function getLineSeriesCue(index: number): ChartLineSeriesCue {
  return getCyclicCue(LINE_SERIES_CUES, index);
}

/** Returns a deterministic point cue for a zero-based series index. */
export function getPointSeriesCue(index: number): ChartPointSeriesCue {
  return getCyclicCue(POINT_SERIES_CUES, index);
}

/** Returns a deterministic bar cue for a zero-based series index. */
export function getBarSeriesCue(index: number): ChartBarSeriesCue {
  return getCyclicCue(BAR_SERIES_CUES, index);
}
