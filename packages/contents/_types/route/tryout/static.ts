import {
  comparePublicRouteOrder,
  makePathSync,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import {
  type PublicTryoutRoute,
  PublicTryoutRouteSchema,
} from "@repo/contents/_types/route/schema";
import type { TryoutExamSource } from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

/** Projects the default source-controlled try-out registry for static routes. */
export function readStaticPublicTryoutRoutes() {
  const routes: PublicTryoutRoute[] = [];
  const emittedCountryPaths = new Set<string>();

  for (const source of TRYOUT_SOURCES) {
    routes.push(
      ...readStaticExamTryoutRoutes({
        emittedCountryPaths,
        source,
      })
    );
  }

  return routes.sort(comparePublicRouteOrder);
}

function readStaticExamTryoutRoutes({
  emittedCountryPaths,
  source,
}: {
  emittedCountryPaths: Set<string>;
  source: TryoutExamSource;
}) {
  const routes: PublicTryoutRoute[] = [];

  for (const locale of locales) {
    const tryoutPath = makePathSync([readNamespaceSegment("tryout", locale)]);
    const countryPath = makePathSync([
      tryoutPath,
      source.countryRouteSlugs[locale],
    ]);
    const examPath = makePathSync([countryPath, source.examRouteSlugs[locale]]);

    if (!emittedCountryPaths.has(`${locale}:${countryPath}`)) {
      routes.push(
        decodeTryoutRouteSync({
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
      decodeTryoutRouteSync({
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
      const trackPath = makePathSync([examPath, track.routeSlugs[locale]]);

      routes.push(
        decodeTryoutRouteSync({
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
        const setPath = makePathSync([trackPath, set.routeSlugs[locale]]);

        routes.push(
          decodeTryoutRouteSync({
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

          routes.push(
            decodeTryoutRouteSync({
              countryKey: source.countryKey,
              examKey: source.examKey,
              kind: "tryout-section",
              locale,
              order: section.order,
              parentPath: setPath,
              publicPath: makePathSync([setPath, section.routeSlugs[locale]]),
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
}

function decodeTryoutRouteSync(
  input: Schema.Schema.Encoded<typeof PublicTryoutRouteSchema>
) {
  return Schema.decodeUnknownSync(PublicTryoutRouteSchema)(input);
}
