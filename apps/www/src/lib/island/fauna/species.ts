import { BEASTS } from "@/lib/island/fauna/beasts";
import { BIRDS } from "@/lib/island/fauna/birds";
import { CRITTERS } from "@/lib/island/fauna/critters";
import { GRAZERS } from "@/lib/island/fauna/grazers";
import { WATERS } from "@/lib/island/fauna/waters";

/**
 * Every animal of the island (ADR 0047, D11), each a real species at its real
 * height in blocks, drawn by its family's shape in its own coat. The catalog's
 * order is the atlas's order and the field guide's.
 */
export const SPECIES = [
  ...BEASTS,
  ...GRAZERS,
  ...BIRDS,
  ...WATERS,
  ...CRITTERS,
] as const;
