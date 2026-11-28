/**
 * Laboratory apparatus as a camera sees it: borosilicate glass and the enamel
 * fired on it, the cast iron, chrome and brass of stands and clamps, the
 * bakelite, enamel and nickel of bench instruments, and the rubber, cork and
 * insulation between them. Every piece of `three/apparatus` takes its colour
 * from here, so a beaker or a meter looks the same in every lesson.
 */
export const LABWARE_COLORS = {
  // The moulded phenolic case of a moving-coil meter and of a knob.
  bakelite: "#1b1513",
  // The bevelled frame that holds a meter's window, black and satin.
  bezel: "#0f1012",
  // The nickel-plated brass of a binding post, a crocodile clip and a 4 mm plug.
  nickel: "#c9cdd1",
  brass: "#b8923a",
  // The grey cast iron of a retort stand's base and a bosshead, stove enamelled.
  castIron: "#3a3d42",
  chrome: "#e3e7ea",
  // The cork lining of a clamp's jaws.
  cork: "#b98d5b",
  // The white card of a moving-coil meter's dial, and the ink printed on it.
  dial: "#f4f3ee",
  dialInk: "#17181a",
  dialRed: "#b3261e",
  // The mirror arc under a precision meter's scale.
  dialMirror: "#aeb6bd",
  // The white ceramic enamel fired on borosilicate glassware.
  enamel: "#f7f9fa",
  // The blue enamel of a burette's or a cylinder's scale.
  enamelBlue: "#2f5fb4",
  // Clear borosilicate 3.3, and the faint green of its wall seen edge on.
  glass: "#e9f4f6",
  glassEdge: "#c3ddd0",
  // A liquid-crystal display unlit, its lit segments, and the glow behind it.
  lcd: "#9aa58c",
  lcdInk: "#141a12",
  // The red and the black insulation of a 4 mm test lead and its plug.
  leadBlack: "#1d1e20",
  leadRed: "#b8322c",
  // The needle of a moving-coil meter, a blackened aluminium blade.
  needle: "#141414",
  // The printed paper jacket of a lantern battery and its black moulded top.
  jacket: "#1d3f8f",
  jacketTop: "#141517",
  // The white PTFE of a burette's stopcock key.
  ptfe: "#f1f0ea",
  // The pale agar jelly of a salt bridge and the cotton wool that plugs it.
  agar: "#efe7cf",
  cotton: "#f3f1ea",
  // A burette reader: a white card and the matt black band across it.
  card: "#f6f5f0",
  cardBand: "#0c0c0d",
  // The glaze of a white tile.
  tile: "#e4ddd2",
  // The red rubber of tubing and a bung, and the black rubber of a foot.
  rubber: "#17181a",
  rubberRed: "#8f3a2c",
  // Electrons shown as moving light on a lead.
  spark: "#ffd66b",
} as const;
