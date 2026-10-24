import "@tanstack/react-start/server-only";
import { ProgramNavigationIconKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import {
  getTileLooks,
  type TileLook,
  type TileRow,
} from "@repo/design-system/lib/look";
import { Array as Arr, Schema, Tuple } from "effect";
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
 * routes of one grid never look alike.
 *
 * A grid whose cards may draw reviewed artwork names that artwork with
 * `readArtwork`. A route that has some comes back as its artwork source, in its
 * place, and takes no icon, no hue, and no turn of its subject from the other
 * routes, so the tiles of the grid look as they would without it.
 *
 * The families hold many icons that a card never needs, so this stays on the
 * server and hands each card only the icon it took.
 *
 * @param routes - The routes of one list, in the order they show
 * @param readArtwork - The source of the reviewed artwork of a route, or nothing when it draws a tile
 * @returns One look per route, or its artwork source, in the same order
 */
export function getCurriculumLooks(
  routes: readonly CurriculumViewRoute[]
): readonly TileLook[];
export function getCurriculumLooks<Artwork extends string>(
  routes: readonly CurriculumViewRoute[],
  readArtwork: (route: CurriculumViewRoute) => Artwork | undefined
): readonly (TileLook | Artwork)[];
export function getCurriculumLooks(
  routes: readonly CurriculumViewRoute[],
  readArtwork: (route: CurriculumViewRoute) => string | undefined = () =>
    undefined
): readonly (TileLook | string)[] {
  const [, rows] = Arr.mapAccum(
    routes,
    Arr.empty<string>(),
    (subjects, route): readonly [readonly string[], TileRow | string] => {
      const artwork = readArtwork(route);

      if (artwork !== undefined) {
        return Tuple.make(subjects, artwork);
      }

      const source = readCurriculumVisualSource(route);

      if (source.kind === "navigation") {
        return Tuple.make(
          subjects,
          Tuple.make(
            Arr.of(CURRICULUM_NAVIGATION_ICONS[source.key]),
            route.nodeKey
          )
        );
      }

      const pool = Arr.contains(subjects, source.key)
        ? getLessonIcons(source.key)
        : getMaterialIcons(source.key);

      return Tuple.make(
        Arr.append(subjects, source.key),
        Tuple.make(pool, route.nodeKey)
      );
    }
  );

  return getTileLooks(rows);
}
