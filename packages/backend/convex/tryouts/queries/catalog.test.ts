import { describe, expect, it } from "@effect/vitest";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { api } from "@repo/backend/convex/_generated/api";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;

describe("public try-out catalog queries", () => {
  it.effect(
    "serves each localized hub, country, exam, and track from the same signed hierarchy",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        const countryPath = `try-out/${TRYOUT_START_COUNTRY}`;
        const examPath = `${countryPath}/${TRYOUT_START_EXAM}`;
        const trackPath = `${examPath}/${TRYOUT_START_TRACK}`;
        for (const [appLocale, title] of [
          ["en", "Mathematics"],
          ["id", "Matematika"],
          ["de", "Mathematik"],
        ] as const) {
          const [hub, country, exam, track] = yield* Effect.promise(() =>
            Promise.all([
              t.query(api.tryouts.queries.catalog.getHubPage, { appLocale }),
              t.query(api.tryouts.queries.catalog.getCountryPage, {
                appLocale,
                publicPath: countryPath,
              }),
              t.query(api.tryouts.queries.catalog.getExamPage, {
                appLocale,
                publicPath: examPath,
              }),
              t.query(api.tryouts.queries.catalog.getTrackPage, {
                appLocale,
                publicPath: trackPath,
              }),
            ])
          );
          expect(hub).toMatchObject({
            countries: [{ countryKey: TRYOUT_START_COUNTRY, examCount: 1 }],
          });
          expect(country).toMatchObject({
            country: { countryKey: TRYOUT_START_COUNTRY },
            exams: [{ examKey: TRYOUT_START_EXAM }],
            sourceRevision: hub.sourceRevision,
          });
          expect(exam).toMatchObject({
            country: { countryKey: TRYOUT_START_COUNTRY },
            exam: { examKey: TRYOUT_START_EXAM },
            tracks: [{ trackKey: TRYOUT_START_TRACK, title }],
          });
          expect(track).toMatchObject({
            country: { countryKey: TRYOUT_START_COUNTRY },
            exam: { examKey: TRYOUT_START_EXAM },
            track: { trackKey: TRYOUT_START_TRACK, title, readySetCount: 1 },
          });
        }
        for (const endpoint of [
          api.tryouts.queries.catalog.getCountryPage,
          api.tryouts.queries.catalog.getExamPage,
          api.tryouts.queries.catalog.getTrackPage,
          api.tryouts.queries.catalog.getSetPage,
          api.tryouts.queries.catalog.getSectionPage,
        ]) {
          expect(
            yield* Effect.promise(() =>
              t.query(endpoint, {
                appLocale: "id",
                publicPath: "try-out/missing",
              })
            )
          ).toBeNull();
        }
      })
  );

  it.effect(
    "does not substitute another locale and keeps set selection within its read budget",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog: makeTryoutStartHierarchy("id", "visible"),
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        expect(
          yield* Effect.promise(() =>
            t.query(api.tryouts.queries.catalog.getLocalizedPath, {
              currentAppLocale: "id",
              targetAppLocale: "en",
              publicPath: setPath,
            })
          )
        ).toBeNull();
        const oversized = convexTest(schema, convexModules);
        const catalog = makeTryoutStartHierarchy("id", "visible").map((row) =>
          Schema.decodeSync(TryoutCatalogRowSchema)(
            row.kind === "set"
              ? {
                  ...row,
                  sectionCount: TRYOUT_CATALOG_LIMIT + 1,
                  visibleSectionCount: TRYOUT_CATALOG_LIMIT + 1,
                  questionCount: TRYOUT_CATALOG_LIMIT + 1,
                }
              : row
          )
        );
        yield* Effect.promise(() =>
          oversized.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            oversized.query(api.tryouts.queries.catalog.getSetPage, {
              appLocale: "id",
              publicPath: setPath,
            })
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("exceeds"),
            },
          })
        );
      })
  );

  it.effect(
    "returns the signed featured selector and localized set metadata",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const { snapshotId } = yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        const featured = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        );
        expect(featured.question).toMatchObject({
          snapshotId,
          delivery: "authenticated",
          contentKey: makeTryoutStartPlacement("id").questionContentKey,
        });
        const metadata = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.catalog.getMetadata, {
            appLocale: "id",
            kind: "set",
            publicPath: setPath,
          })
        );
        expect(metadata.route).toMatchObject({
          publicPath: setPath,
          title: "Set 1",
        });
        expect(
          metadata.route?.alternates.map(({ appLocale }) => appLocale)
        ).toEqual(["en", "id", "de"]);
        expect(
          yield* Effect.promise(() =>
            t.query(api.tryouts.queries.catalog.getCountryPage, {
              appLocale: "id",
              publicPath: "try-out/missing",
            })
          )
        ).toBeNull();
      })
  );

  it.effect(
    "fails closed at each missing level of the featured hierarchy",
    () =>
      Effect.gen(function* () {
        for (const kind of ["country", "exam", "track", "set"] as const) {
          const t = convexTest(schema, convexModules);
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              activateTryoutSnapshot(ctx, {
                catalog: makeTryoutStartHierarchy("id", "visible").filter(
                  (row) => row.kind !== kind
                ),
                placements: [makeTryoutStartPlacement("id")],
              })
            )
          );
          yield* Effect.promise(() =>
            expect(
              t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
                appLocale: "id",
              })
            ).rejects.toMatchObject({
              data: {
                code: "CONTENT_RELEASE_INTEGRITY",
                message: expect.stringContaining(`no featured ${kind}`),
              },
            })
          );
          if (kind === "country" || kind === "exam") {
            const endpoint =
              kind === "country"
                ? api.tryouts.queries.catalog.getExamPage
                : api.tryouts.queries.catalog.getTrackPage;
            const publicPath =
              kind === "country"
                ? `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}`
                : `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}`;
            yield* Effect.promise(() =>
              expect(
                t.query(endpoint, { appLocale: "id", publicPath })
              ).rejects.toMatchObject({
                data: { code: "CONTENT_RELEASE_INTEGRITY" },
              })
            );
          }
        }
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog: makeTryoutStartHierarchy("id", "visible"),
              placements: [makeTryoutStartPlacement("id")],
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
              appLocale: "id",
            })
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("no featured question"),
            },
          })
        );
      })
  );

  it.effect(
    "rejects set pages whose signed parent or section relationships are incomplete",
    () =>
      Effect.gen(function* () {
        for (const kind of [
          "country",
          "exam",
          "track",
          "section",
          "set",
        ] as const) {
          const t = convexTest(schema, convexModules);
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              activateTryoutSnapshot(ctx, {
                catalog: makeTryoutStartHierarchy("id", "visible").filter(
                  (row) => row.kind !== kind
                ),
                placements: [makeTryoutStartPlacement("id")],
              })
            )
          );
          const publicPath =
            kind === "set" ? `${setPath}/${TRYOUT_START_SECTION}` : setPath;
          const endpoint =
            kind === "set"
              ? api.tryouts.queries.catalog.getSectionPage
              : api.tryouts.queries.catalog.getSetPage;
          yield* Effect.promise(() =>
            expect(
              t.query(endpoint, { appLocale: "id", publicPath })
            ).rejects.toMatchObject({
              data: { code: "CONTENT_RELEASE_INTEGRITY" },
            })
          );
        }
      })
  );
});
