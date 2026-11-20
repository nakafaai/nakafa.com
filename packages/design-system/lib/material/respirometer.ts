/**
 * A simple respirometer on a school bench: germinating mung beans, the
 * rubber, steel and painted hardware that hold the tubes, the scale board
 * behind the capillaries, and the water bath, as a camera sees them.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const RESPIROMETER_COLORS = {
  // A mung bean's dull green seed coat, a darker and a paler shade of it,
  // the white hilum scar along its side, and the creamy radicle that breaks
  // out of a germinating seed.
  coat: "#58763a",
  coatDark: "#3f5a29",
  coatPale: "#7d9a4c",
  hilum: "#efe9d2",
  radicle: "#e8dcbc",

  // Natural rubber bungs and tubing, the black plastic of a clamp's jaws,
  // and the zinc-plated steel of a screw clip and the wire gauze.
  rubber: "#4a231c",
  jaw: "#222326",
  zinc: "#b8bcbf",
  gauze: "#9ea3a6",

  // The enamelled steel of a retort stand's base, its chrome rod, and the
  // die-cast body of a clamp.
  standBase: "#27333d",
  rod: "#d4d8dc",
  clampBody: "#8d9399",

  // The white face of the scale board, its plywood edge, and the printed
  // ink of its graduations.
  board: "#d6d0c0",
  boardEdge: "#c8a878",
  ink: "#1c1a17",

  // The red dye of the index drop, the red spirit of the thermometer, and
  // the white enamel of a beaker's graduations and a thermometer's back.
  // The faint grey-green of clear borosilicate glass seen face on.
  glassTint: "#53666a",
  // The bath water and the clear solutions in the tubes, seen as a faint
  // tint over what lies behind them.
  bath: "#7c9ca3",
  solution: "#5a6c70",
  dye: "#c2263a",
  spirit: "#d0242c",
  enamel: "#f7f7f4",
} as const;
