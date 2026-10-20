import type { MaterialList } from "@repo/contents/curriculum/list";
import type { ParsedHeading } from "@repo/contents/toc";
import { toAnchorSlug } from "@repo/utilities/slug";
import { Array as Arr } from "effect";

/** Builds sidebar chapter links from rendered material cards. */
export function readMaterialCardChapters(cards: MaterialList): ParsedHeading[] {
  return Arr.map(cards, (card) => ({
    children: [],
    href: `#${toAnchorSlug(card.title)}`,
    label: card.title,
  }));
}
