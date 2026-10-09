import type { ElementName } from "@repo/design-system/components/contents/chemistry/element";

/** The chemical symbol that a particle scene writes beside an atom. */
export function atomSymbol(element: ElementName) {
  if (element === "carbon") {
    return "C";
  }

  if (element === "hydrogen") {
    return "H";
  }

  if (element === "nitrogen") {
    return "N";
  }

  return "O";
}
