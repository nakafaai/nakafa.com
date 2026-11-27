/**
 * The one colour of each real material a lab object is made of, as a camera
 * sees it under white light. A metal's colour is its measured reflectance at
 * normal incidence (Akenine-Moller, Haines and Hoffman, Real-Time Rendering,
 * 4th edition, table 9.2), written in sRGB; an alloy without a row there
 * takes the row of the metal that gives it its colour. Brass and copper are
 * a step deeper than their fresh-cut rows: in air both wear a thin oxide
 * within days, and that is the colour apparatus has. Cast iron is the colour
 * of its fire scale. Everything else is its diffuse colour. `three/matter`
 * binds each to its surface, so a lab names the material and never a colour
 * of its own for it.
 */
export const MATTER_COLORS = {
  // Bare metals, by reflectance.
  aluminium: "#f5f6f6",
  brass: "#dcb968",
  chrome: "#c4c5c4",
  copper: "#d98c5f",
  gold: "#ffe59e",
  iron: "#5a5c5f",
  mercury: "#e5e5e4",
  nichrome: "#cfcabf",
  nickel: "#d4cdc0",
  solder: "#dcdad3",
  steel: "#cbcbc9",
  tungsten: "#bcbbb6",
  // What a hot wire radiates: red heat near 900 K, orange near 1500 K, and
  // the warm white of a filament near 2700 K.
  heatRed: "#ff3d0a",
  heatOrange: "#ff8a2a",
  heatWhite: "#ffe2b0",
  // Sawn wood, each at the colour of its pale early wood.
  beech: "#c9a26b",
  maple: "#dcc096",
  oak: "#c08a4a",
  walnut: "#6a432a",
  // Glass, ice and the things moulded, fired or pressed.
  bakelite: "#1f1b18",
  cork: "#b08968",
  foam: "#f1f0ea",
  glass: "#eef4f2",
  // The faint green white light turns on its way through a thick glass wall.
  glassEdge: "#cfe8d6",
  ice: "#dff0f7",
  mica: "#d8c9a0",
  paper: "#f4f1e8",
  porcelain: "#f1eee6",
  rubber: "#17181b",
  wax: "#f1ead6",
  // The body of something that only shines: it reflects nothing of its own.
  dark: "#000000",
} as const;
