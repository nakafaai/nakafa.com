import "@tanstack/react-start/server-only";
import { isRenderableCurriculumLevel } from "@nakafa/aksara-contracts/program/curriculum";
import { Array as Arr, Effect, Option } from "effect";
import { readPublishedProgramRoute } from "@/lib/content/program/route";
import { getCurriculumLooks } from "@/lib/curriculum/look";
import type {
  CurriculumRouteModel,
  CurriculumViewRoute,
  readRuntimeCurriculumCatalog,
} from "@/lib/curriculum/model";
import { isRenderableCurriculumView } from "@/lib/curriculum/routes";

type CurriculumCatalog = Effect.Success<
  ReturnType<typeof readRuntimeCurriculumCatalog>
>;

/**
 * The pages at one place of a curriculum path, each with the icon its card draws, the page on the path among them
 * (`current`). The flag of a curriculum's country, when it has one, stands for its icon.
 */
function trailOptions(
  node: CurriculumViewRoute,
  siblings: readonly CurriculumViewRoute[],
  countryOf: (route: CurriculumViewRoute) => string | undefined
) {
  return Arr.zipWith(siblings, getCurriculumLooks(siblings), (route, look) => {
    const countryCode = countryOf(route);
    return {
      ...(countryCode === undefined ? {} : { countryCode }),
      current: route.publicPath === node.publicPath,
      icon: look.icon,
      publicPath: route.publicPath,
      title: route.title,
    };
  });
}

/**
 * The path of a curriculum page as Google Drive draws one, a level per crumb: the curriculum among every curriculum of
 * the catalog, then each page under it among its parent's children, down to the page itself. Each parent's children are
 * read from its own published route, which the content store holds once per release.
 */
export const readCurriculumTrail = Effect.fn("www.curriculum.readTrail")(
  function* (model: CurriculumRouteModel, catalog: CurriculumCatalog) {
    const path = Arr.append(model.ancestors, model.route);
    const children = yield* Effect.forEach(
      model.ancestors,
      (parent) =>
        readPublishedProgramRoute(model.locale, parent.publicPath).pipe(
          Effect.map((published) =>
            Arr.filter(published.children, isRenderableCurriculumView)
          )
        ),
      { concurrency: "unbounded" }
    );
    const roots = Arr.map(catalog.entries, (entry) => entry.route);
    const countryOf = (route: CurriculumViewRoute) =>
      Option.getOrUndefined(
        Option.flatMap(
          Arr.findFirst(
            catalog.entries,
            (entry) => entry.route.publicPath === route.publicPath
          ),
          (entry) => Option.fromNullishOr(entry.program.provider.homeCountry)
        )
      );

    // Every page of the path is a renderable view, whose level names the menu of its crumb.
    return Arr.getSomes(
      Arr.zipWith(path, Arr.prepend(children, roots), (node, siblings) =>
        isRenderableCurriculumLevel(node.level)
          ? Option.some({
              level: node.level,
              options: trailOptions(node, siblings, countryOf),
            })
          : Option.none()
      )
    );
  }
);

export type CurriculumTrail = Effect.Success<
  ReturnType<typeof readCurriculumTrail>
>;
