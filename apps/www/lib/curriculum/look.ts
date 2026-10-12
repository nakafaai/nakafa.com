import "server-only";
import { ProgramNavigationIconKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, Schema } from "effect";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";
import type { CurriculumViewRoute } from "@/lib/curriculum/model";

const CurriculumVisualSourceSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("material"),
    key: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("navigation"),
    key: ProgramNavigationIconKeySchema,
  }),
]);

type CurriculumVisualSource = typeof CurriculumVisualSourceSchema.Type;

/**
 * Selects the source-owned identity that drives curriculum card visuals.
 *
 * Generic subject icon keys stay domain-driven so science siblings keep
 * biology, chemistry, and physics identities from `materialDomain`; specific
 * course/stage keys keep their authored navigation identity.
 */
function readCurriculumVisualSource(
  route: CurriculumViewRoute
): CurriculumVisualSource {
  if (!route.materialDomain) {
    return { kind: "navigation", key: route.iconKey };
  }

  if (
    route.iconKey &&
    route.iconKey !== "mathematics" &&
    route.iconKey !== "science"
  ) {
    return { kind: "navigation", key: route.iconKey };
  }

  return { kind: "material", key: route.materialDomain };
}

/**
 * The icon and the turn of the tile of each route of one grid or list, so that
 * no two tiles of it share an icon or a blend.
 *
 * A route of a stage or a course draws the navigation icon of its key. The
 * first route of a subject in the list draws the own icon of that subject, so
 * the subject looks the same on every grid, and a later route of the same
 * subject takes another icon of the family of that subject, so two mathematics
 * routes of one grid never look alike. A route with artwork keeps its place in
 * the list, so the other tiles look the same with or without it.
 *
 * The families hold many icons that a card never needs, so this stays on the
 * server and hands each card only the icon it took.
 *
 * @param routes - The routes of one list, in the order they show
 * @returns One look per route, in the same order
 */
export function getCurriculumLooks(routes: readonly CurriculumViewRoute[]) {
  const [, rows] = Arr.mapAccum(
    routes,
    Arr.empty<string>(),
    (subjects, route) => {
      const source = readCurriculumVisualSource(route);

      if (source.kind === "navigation") {
        return [
          subjects,
          [Arr.of(CURRICULUM_NAVIGATION_ICONS[source.key]), route.nodeKey],
        ] as const;
      }

      const pool = Arr.contains(subjects, source.key)
        ? getLessonIcons(source.key)
        : getMaterialIcons(source.key);

      return [Arr.append(subjects, source.key), [pool, route.nodeKey]] as const;
    }
  );

  return getTileLooks(rows);
}
