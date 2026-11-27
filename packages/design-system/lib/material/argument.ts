/**
 * The argument chain lab's objects as a camera sees them: an oiled oak rail
 * with three felt pockets and a brass name plate over each, steel chain links
 * between the pockets that turn to brass once they lock and to red enamel
 * once they break, a lamp strip round the conclusion's pocket, cream index
 * cards with navy index tabs, a charcoal felt tray for the hand, and the red
 * seal that marks a false card. A simulation that shows one of them takes its
 * colour from here, so it looks the same in every lesson.
 */
export const ARGUMENT_COLORS = {
  // The rail's felt pockets and the brass-yellow enamel plate over each.
  pocket: "#3b3532",
  plate: "#c9a24a",
  plateInk: "#2b2115",
  // The links: brass once locked, red once broken.
  locked: "#d9a63a",
  broken: "#c0352b",
  // The lamp strip round the conclusion's pocket, dark and lit.
  lampOff: "#4a4643",
  lampOn: "#ffcf6e",
  // Cream index card stock and the ink printed on it.
  paper: "#f5efe0",
  ink: "#1f2329",
  // The navy index tab of a hand card and the shape punched on it.
  tab: "#24406e",
  tabShape: "#f5efe0",
  // The charcoal felt tray the hand lies on.
  tray: "#33373c",
  // The seal that marks a false card, and its cross.
  seal: "#c62828",
  sealCross: "#fff7f0",
} as const;
