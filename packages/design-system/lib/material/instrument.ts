/**
 * Measuring instruments and the things they measure, as a camera sees them.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const INSTRUMENT_COLORS = {
  aluminium: "#c3c8cc",
  bowlingResin: "#3a1f52",
  brass: "#b8923a",
  // The dark anodised aluminium of a display rail or an optical bench.
  anodised: "#30343a",
  // Tungsten carbide measuring faces, darker and greyer than the steel that carries them.
  carbide: "#6f747b",
  // The moulded case of a digital stopwatch, and the legends printed on it.
  caseLegend: "#d7dbe0",
  caseShell: "#23272c",
  copper: "#b46a3c",
  // The clear crystal over a dial.
  crystal: "#eef4f8",
  dialFace: "#f4f3ee",
  dialNeedle: "#c0262d",
  enamel: "#34495e",
  eraser: "#e08a8f",
  // The lapped black granite of a surface plate.
  granite: "#3b4046",
  graphite: "#2e2f31",
  // The moulded heat guard on the frame of a micrometer.
  gripPad: "#1b1d20",
  hair: "#5b3a24",
  // The grey-green hammertone enamel of a cast balance housing.
  hammertone: "#66736f",
  iris: "#4e3423",
  iron: "#80848a",
  lampLight: "#fff1d6",
  // A liquid-crystal display: its grey-green ground and its dark figures.
  lcd: "#b3bca6",
  lcdInk: "#161a17",
  laserBeam: "#ff3b30",
  lead: "#5e6268",
  metreRule: "#e0b04a",
  oak: "#8a5a34",
  paper: "#f2f0e8",
  pencilBlue: "#2f4f86",
  pencilGreen: "#2f6a4e",
  pencilWood: "#e0c095",
  pencilYellow: "#e5b52a",
  pine: "#d9b37c",
  platinum: "#d3d5d8",
  // The pushers of a stopwatch: start and reset, and the stop between them.
  pusher: "#e3b324",
  pusherStop: "#c7372f",
  // The off-white card a results sheet is printed on.
  recordCard: "#cdc8b8",
  // Satin chrome over hardened steel: a micrometer barrel, a caliper slide.
  satinChrome: "#c9cdd2",
  // The black ink that fills an engraved graduation.
  scaleInk: "#141619",
  // The lined paper of a results sheet, and its faint rules.
  sheet: "#f6f3ea",
  sheetRule: "#b9c4cf",
  silver: "#c4c8cc",
  statusLed: "#3ddc84",
  tapeYellow: "#efc12f",
  // Ground and hardened tool steel: a caliper beam, a spindle, a steel rule.
  toolSteel: "#b4b9bf",
  trolleyPaint: "#2c5d8f",
  // Bright zinc plating over a steel fastener.
  zinc: "#aab1b9",
} as const;
