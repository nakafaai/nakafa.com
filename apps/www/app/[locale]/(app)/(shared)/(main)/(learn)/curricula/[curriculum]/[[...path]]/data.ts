import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/routing/slug";

/** Builds sidebar chapter links from rendered material cards. */
export function readMaterialCardChapters(cards: MaterialList): ParsedHeading[] {
  return cards.map((card) => ({
    children: [],
    href: `#${slugify(card.title)}`,
    label: card.title,
  }));
}
