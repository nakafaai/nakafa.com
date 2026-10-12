import "server-only";
import type { TrendingSubject } from "@repo/backend/confect/lib/validators/trending";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getTileLooks } from "@repo/design-system/lib/tile";
import { Array as Arr } from "effect";

/**
 * The icon and the turn of the tile of each lesson row of one home list, so
 * that two lessons of one list never share an icon or a blend, even when they
 * belong to one subject. A lesson starts from the icon its own id points at in
 * the family of its subject, so it keeps its look from visit to visit.
 *
 * The families hold many icons that a row never needs, so this stays on the
 * server and passes each row only the icon it took.
 *
 * @param materials - The rows of one list, in the order they show
 * @returns One look per row, in the same order
 */
export function getMaterialLooks(
  materials: readonly Pick<TrendingSubject, "content_id" | "materialDomain">[]
) {
  return getTileLooks(
    Arr.map(
      materials,
      (material) =>
        [getLessonIcons(material.materialDomain), material.content_id] as const
    )
  );
}
