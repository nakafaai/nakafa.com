import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  lookupNamespaceSegment,
  makePath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import { PublicTryoutRouteSchema } from "@repo/contents/_types/route/schema";
import type { TryoutExamSource } from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

type PublicTryoutRoute = Schema.Schema.Type<typeof PublicTryoutRouteSchema>;

/** Projects source-controlled try-out exams into public country/exam/track/set/section rows. */
export const listPublicTryoutRoutes = Effect.fn("contents.route.listTryouts")(
  function* ({ tryouts = TRYOUT_SOURCES }: Pick<RouteInputs, "tryouts"> = {}) {
    const routes: PublicTryoutRoute[] = [];
    const emittedCountryPaths = new Set<string>();

    for (const source of tryouts) {
      routes.push(
        ...(yield* listExamTryoutRoutes({
          emittedCountryPaths,
          source,
        }))
      );
    }

    return yield* uniqueRoutes(routes);
  }
);

function listExamTryoutRoutes({
  emittedCountryPaths,
  source,
}: {
  emittedCountryPaths: Set<string>;
  source: TryoutExamSource;
}) {
  return Effect.gen(function* () {
    const routes: PublicTryoutRoute[] = [];

    for (const locale of locales) {
      const tryoutPath = yield* makePath([
        yield* lookupNamespaceSegment("tryout", locale),
      ]);
      const countryPath = yield* makePath([
        tryoutPath,
        source.countryRouteSlugs[locale],
      ]);
      const examPath = yield* makePath([
        countryPath,
        source.examRouteSlugs[locale],
      ]);

      if (!emittedCountryPaths.has(`${locale}:${countryPath}`)) {
        routes.push(
          yield* decodeTryoutRoute({
            countryKey: source.countryKey,
            description: source.countryTranslations[locale].description,
            kind: "tryout-country",
            locale,
            order: 0,
            publicPath: countryPath,
            sitemap: true,
            sourceRevision: source.sourceRevision,
            title: source.countryTranslations[locale].title,
          })
        );
        emittedCountryPaths.add(`${locale}:${countryPath}`);
      }

      routes.push(
        yield* decodeTryoutRoute({
          countryKey: source.countryKey,
          description: source.examTranslations[locale].description,
          examKey: source.examKey,
          kind: "tryout-exam",
          locale,
          order: 0,
          parentPath: countryPath,
          publicPath: examPath,
          sitemap: true,
          sourceRevision: source.sourceRevision,
          title: source.examTranslations[locale].title,
        })
      );

      for (const track of source.tracks) {
        const trackPath = yield* makePath([examPath, track.routeSlugs[locale]]);

        routes.push(
          yield* decodeTryoutRoute({
            countryKey: source.countryKey,
            examKey: source.examKey,
            kind: "tryout-track",
            locale,
            order: track.order,
            parentPath: examPath,
            publicPath: trackPath,
            sitemap: true,
            sourceRevision: source.sourceRevision,
            title: track.translations[locale].title,
            trackKey: track.key,
          })
        );

        for (const set of track.sets) {
          const setPath = yield* makePath([trackPath, set.routeSlugs[locale]]);

          routes.push(
            yield* decodeTryoutRoute({
              countryKey: source.countryKey,
              examKey: source.examKey,
              kind: "tryout-set",
              locale,
              order: set.order,
              parentPath: trackPath,
              publicPath: setPath,
              setKey: set.key,
              sitemap: true,
              sourceRevision: source.sourceRevision,
              title: set.translations[locale].title,
              trackKey: track.key,
            })
          );

          for (const section of set.sections) {
            if (section.visibility === "internal-entry") {
              continue;
            }

            const sectionPath = yield* makePath([
              setPath,
              section.routeSlugs[locale],
            ]);

            routes.push(
              yield* decodeTryoutRoute({
                countryKey: source.countryKey,
                examKey: source.examKey,
                kind: "tryout-section",
                locale,
                order: section.order,
                parentPath: setPath,
                publicPath: sectionPath,
                sectionKey: section.key,
                setKey: set.key,
                sitemap: true,
                sourceRevision: source.sourceRevision,
                title: section.translations[locale].title,
                trackKey: track.key,
              })
            );
          }
        }
      }
    }

    return routes;
  });
}

function decodeTryoutRoute(
  input: Schema.Schema.Encoded<typeof PublicTryoutRouteSchema>
) {
  return Schema.decodeUnknown(PublicTryoutRouteSchema)(input);
}
