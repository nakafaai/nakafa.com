import { describe, expect, it } from "@effect/vitest";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import {
  indexPublishedCatalog,
  readPublishedSetParents,
  readPublishedSetSections,
  readPublishedTrackSets,
} from "@repo/backend/content/tryout/hierarchy";
import {
  readPublishedSectionPageFromIndex,
  readPublishedSetPageFromIndex,
} from "@repo/backend/content/tryout/published";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
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

const trackIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  trackKey: TRYOUT_START_TRACK,
};
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;

const loadCatalog = Effect.fn("tryout.hierarchy.test.loadCatalog")(function* (
  catalog: readonly TryoutCatalogRow[]
) {
  const t = convexTest(schema, convexModules);
  yield* Effect.promise(() =>
    t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog,
        placements: [makeTryoutStartPlacement("id")],
      })
    )
  );
  return yield* Effect.promise(() =>
    t.query((ctx) =>
      runConvexProgram(
        loadTryoutCatalog("id").pipe(Effect.provide(convexTryoutLayer(ctx)))
      )
    )
  );
});

describe("signed try-out hierarchy relationships", () => {
  it.effect(
    "rejects duplicate public routes despite individually valid signed rows",
    () =>
      Effect.gen(function* () {
        const rows = makeTryoutStartHierarchy("id", "visible");
        const catalog = yield* loadCatalog([
          ...rows,
          ...rows
            .filter((row) => row.kind === "country")
            .map((row) =>
              Schema.decodeSync(TryoutCatalogRowSchema)({
                ...row,
                countryKey: "malaysia",
              })
            ),
        ]);
        expect(
          yield* indexPublishedCatalog(catalog).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("duplicated"),
        });
      })
  );

  it.effect(
    "rejects missing country, exam, or track parents in an authenticated catalog",
    () =>
      Effect.gen(function* () {
        for (const kind of ["country", "exam", "track"] as const) {
          const catalog = yield* loadCatalog(
            makeTryoutStartHierarchy("id", "visible").filter(
              (row) => row.kind !== kind
            )
          );
          const index = yield* indexPublishedCatalog(catalog);
          const set = index.sets.at(0);
          if (set === undefined) {
            return yield* Effect.die("Expected a signed set.");
          }
          expect(
            yield* readPublishedSetParents(index, set).pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
      })
  );

  it.effect(
    "checks authored set and section counts before projecting a hierarchy",
    () =>
      Effect.gen(function* () {
        const catalog = yield* loadCatalog(
          makeTryoutStartHierarchy("id", "visible")
        );
        expect(
          yield* readPublishedTrackSets(catalog, {
            ...trackIdentity,
            trackKey: "missing",
          })
        ).toBeNull();
        const changedTrack = yield* loadCatalog(
          makeTryoutStartHierarchy("id", "visible").map((row) =>
            Schema.decodeSync(TryoutCatalogRowSchema)(
              row.kind === "track" ? { ...row, setCount: 2 } : row
            )
          )
        );
        expect(
          yield* readPublishedTrackSets(changedTrack, trackIdentity).pipe(
            Effect.flip
          )
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("sets"),
        });
        for (const patch of [
          { questionCount: 2 },
          { sectionCount: 2, visibleSectionCount: 2 },
        ]) {
          const changed = yield* loadCatalog(
            makeTryoutStartHierarchy("id", "visible").map((row) =>
              Schema.decodeSync(TryoutCatalogRowSchema)(
                row.kind === "set" ? { ...row, ...patch } : row
              )
            )
          );
          const index = yield* indexPublishedCatalog(changed);
          const set = index.sets.at(0);
          if (set === undefined) {
            return yield* Effect.die("Expected a signed set.");
          }
          expect(
            yield* readPublishedSetSections(index, set).pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
      })
  );

  it.effect(
    "resolves no page for absent routes and rejects an orphan section or lost private entry",
    () =>
      Effect.gen(function* () {
        const catalog = yield* loadCatalog(
          makeTryoutStartHierarchy("id", "visible").filter(
            (row) => row.kind !== "set"
          )
        );
        const index = yield* indexPublishedCatalog(catalog);
        expect(yield* readPublishedSetPageFromIndex(index, setPath)).toBeNull();
        expect(
          yield* readPublishedSectionPageFromIndex(index, `${setPath}/missing`)
        ).toBeNull();
        expect(
          yield* readPublishedSectionPageFromIndex(
            index,
            `${setPath}/${TRYOUT_START_SECTION}`
          ).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("lost its set"),
        });
        const internal = yield* loadCatalog(
          makeTryoutStartHierarchy("id", "internal-entry").map((row) =>
            Schema.decodeSync(TryoutCatalogRowSchema)(
              row.kind === "set"
                ? { ...row, internalEntrySectionKey: "missing" }
                : row
            )
          )
        );
        const internalIndex = yield* indexPublishedCatalog(internal);
        expect(
          yield* readPublishedSetPageFromIndex(internalIndex, setPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("internal entry"),
        });
      })
  );
});
