/**
 * A blood grouping test on the bench, as a camera sees it: the glazed tile,
 * the dyed monoclonal antisera, whole blood, and the plastic it is handled
 * with. Anti-A is dyed with patent blue and anti-B with tartrazine, so the two
 * cannot be mixed up; anti-D carries no dye.
 *
 * @see Rapid Biotec, "Monoclonal Blood Grouping Reagents" instructions for use
 * (Doc Ref CE ABO RB 04/2024): anti-A blue (patent blue), anti-B yellow
 * (tartrazine), anti-A,B colourless.
 * @see Fondation Mérieux, "Blood Grouping and Rh Typing Practices" job aid,
 * figure 1: blue anti-A, yellow anti-B and colourless anti-RhD vials.
 */
export const SEROLOGY_COLORS = {
  // Anti-A as patent blue V tints it, and anti-B as tartrazine does, as the
  // job aid's photographed vials show them; anti-D clear with a faint straw.
  antiA: "#2f9fd8",
  antiB: "#f2c418",
  antiD: "#ece6cf",
  // Whole blood: a thin film over white glaze, and a clump, darker still,
  // its cells packed close where the suspension spreads them out.
  blood: "#a3121c",
  bloodDeep: "#7e0b14",
  clump: "#62060e",
  // The clear fluid left between clumps: plasma and serum, tinged by the
  // few cells still free.
  plasma: "#f6d6cc",
  // The white rubber bulb and polypropylene screw cap of a dropper vial.
  bulb: "#f6efe3",
  cap: "#fdf6ea",
  // A K2EDTA blood tube's lavender closure and its paper label.
  edta: "#9d86cf",
  label: "#fbfbf7",
  labelInk: "#3b4049",
  // Glazed white porcelain. The whites here lean a shade warm, because the
  // teaching lab's daylight, which lights every lab, is a cool blue.
  glaze: "#fff4e4",
  // Low-density polyethylene of a transfer pipette, and a stirrer's
  // polystyrene.
  polythene: "#f1f0ea",
  stirrer: "#fdf7ec",
} as const;
