/**
 * A road and its roadside, as a camera sees them in daylight.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const ROAD_COLORS = {
  asphalt: "#3a3c3f",
  bark: "#4a3a2c",
  distancePost: "#f2f1ec",
  foliage: "#4d6b36",
  foliageDark: "#38532a",
  foliageLight: "#57743c",
  foliageShade: "#425f2f",
  grass: "#66744a",
  gravel: "#8b8070",
  gravelGroove: "#4f463c",
  ice: "#b8d0dc",
  icePolish: "#f2f8fb",
  kerb: "#b9b6ae",
  lampPost: "#5f646a",
  pavement: "#a7a39a",
  roadPaint: "#e9e7df",
  skidRubber: "#050505",
  snow: "#e8edf1",
  snowTrack: "#8fa3b1",
  wetAsphalt: "#1f2124",
} as const;
