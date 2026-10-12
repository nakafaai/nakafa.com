import "server-only";
import type { TrendingSubject } from "@repo/backend/confect/lib/validators/trending";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getTileLooks, type TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";

/**
 * The icon and the turn of the tile of each lesson row of one home list, so
 * that two lessons of one list never share an icon or a blend, even when they
 * belong to one subject. A lesson starts from the icon its own id points at in
 * the family of its subject, so it keeps its look from visit to visit.
 *
 * The home page shows two lists, Continue learning and Trending, and a lesson
 * can stand in both. The second list passes the looks of the first as `shown`,
 * so no lesson of it takes an icon that the first list shows while its family
 * has a free one, and a lesson that stands in both lists draws two different
 * icons on that page.
 *
 * The families hold many icons that a row never needs, so this stays on the
 * server and passes each row only the icon it took.
 *
 * @param materials - The rows of one list, in the order they show
 * @param shown - The looks of the lists that the page shows before this one
 * @returns One look per row, in the same order
 */
export function getMaterialLooks(
  materials: readonly Pick<TrendingSubject, "content_id" | "materialDomain">[],
  shown: readonly TileLook[] = []
) {
  return getTileLooks(
    Arr.map(
      materials,
      (material) =>
        [getLessonIcons(material.materialDomain), material.content_id] as const
    ),
    shown
  );
}
