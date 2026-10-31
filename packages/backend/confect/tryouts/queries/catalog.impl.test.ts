import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { catalogNodeIdentity } from "@repo/backend/confect/tryouts/catalog/rows";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { FIXTURE_REVISION } from "@repo/backend/test/assessment/snapshot";
import { client } from "@repo/backend/test/client";
import { type TryoutWorld, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Schema, Struct } from "effect";

const catalog = tryouts.queries.catalog;
const SET_PATH = "try-out/indonesia/snbt/2027/set-1-id";
const KEYS = { countryKey: "indonesia", examKey: "snbt", trackKey: "2027" };

/** Changes the stored catalog row of one node of the active snapshot: deletes it, or stores it twice. */
const tamperCatalog = (
  world: TryoutWorld,
  keys: Parameters<typeof catalogNodeIdentity>[0],
  change: "delete" | "duplicate"
) =>
  Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("assessmentRows")
        .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
          query
            .eq("snapshotId", world.snapshotId)
            .eq("kind", "catalog")
            .eq("identity", catalogNodeIdentity(keys))
        )
        .unique();
      assert.ok(row, "Expected the catalog row.");
      if (change === "delete") {
        await ctx.db.delete("assessmentRows", row._id);
        return;
      }
      await ctx.db.insert("assessmentRows", {
        ...Struct.omit(row, ["_creationTime", "_id"]),
        identity: `${row.identity}-copy`,
      });
    })
  );

describe("tryouts/queries/catalog", () => {
  it.effect("reads nothing before any release activates a snapshot", () =>
    Effect.gen(function* () {
      const visitor = client(createConvexTestWithBetterAuth());
      expect(
        yield* visitor
          .query(catalog.getHubPage, { appLocale: "id" })
          .pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_MISSING",
      });
    })
  );

  it.effect(
    "navigates the hub, a country, an exam, and a track with the revision of their catalog",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const page = (ref: typeof catalog.getCountryPage, publicPath: string) =>
          world.visitor.query(ref, { appLocale: "id", publicPath });
        expect(
          yield* world.visitor.query(catalog.getHubPage, { appLocale: "id" })
        ).toEqual({
          countries: [
            {
              countryCode: "ID",
              countryKey: "indonesia",
              description: "Try-out Indonesia",
              examCount: 1,
              publicPath: "try-out/indonesia-id",
              title: "Try-out",
            },
          ],
          sourceRevision: FIXTURE_REVISION,
        });
        expect(
          yield* page(catalog.getCountryPage, "try-out/indonesia-id")
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exams: [{ examKey: "snbt", publicPath: "try-out/indonesia/snbt-id" }],
          sourceRevision: FIXTURE_REVISION,
        });
        expect(
          yield* world.visitor.query(catalog.getExamPage, {
            appLocale: "id",
            publicPath: "try-out/indonesia/snbt-id",
          })
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt" },
          tracks: [{ trackKey: "2027", trackKind: "year" }],
        });
        expect(
          yield* world.visitor.query(catalog.getTrackPage, {
            appLocale: "id",
            publicPath: "try-out/indonesia/snbt/2027-id",
          })
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt" },
          track: { trackKey: "2027" },
        });
        for (const ref of [
          catalog.getCountryPage,
          catalog.getExamPage,
          catalog.getTrackPage,
          catalog.getSetPage,
          catalog.getSectionPage,
        ]) {
          expect(
            yield* world.visitor.query(ref, {
              appLocale: "id",
              publicPath: "try-out/nowhere",
            })
          ).toBeNull();
        }
      })
  );

  it.effect(
    "shows a set and its visible sections with counts and times from its paper and profile",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          scoring: {
            kind: "penalized",
            marks: { blank: 0, correct: 4, wrong: -1 },
          },
        });
        const section = {
          questionCount: 2,
          sectionKey: "section-a",
          timeLimitSeconds: 600,
          visibility: "visible",
        };
        expect(
          yield* world.visitor.query(catalog.getSetPage, {
            appLocale: "id",
            publicPath: SET_PATH,
          })
        ).toMatchObject({
          entrySection: section,
          exam: { examKey: "snbt" },
          sections: [
            section,
            {
              questionCount: 1,
              sectionKey: "section-b",
              timeLimitSeconds: 300,
            },
          ],
          set: {
            publicPath: SET_PATH,
            questionCount: 3,
            scoringStrategy: "penalized",
            sectionCount: 2,
            visibleSectionCount: 2,
          },
          track: { trackKey: "2027" },
        });
        expect(
          yield* world.visitor.query(catalog.getSectionPage, {
            appLocale: "id",
            publicPath: `${SET_PATH}/section-b`,
          })
        ).toMatchObject({
          section: { questionCount: 1, sectionKey: "section-b" },
          set: { publicPath: SET_PATH },
        });
        expect(
          yield* world.visitor.query(catalog.getSectionPage, {
            appLocale: "id",
            publicPath: SET_PATH,
          })
        ).toBeNull();
      })
  );

  it.effect(
    "enters a direct-entry set through its internal section, which shows no page of its own",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        expect(
          yield* world.visitor.query(catalog.getSetPage, {
            appLocale: "id",
            publicPath: SET_PATH,
          })
        ).toMatchObject({
          entrySection: {
            sectionKey: "section-a",
            visibility: "internal-entry",
          },
          sections: [],
          set: { sectionCount: 1, visibleSectionCount: 0 },
        });
        expect(
          yield* world.visitor.query(catalog.getHubPage, { appLocale: "id" })
        ).not.toBeNull();
      })
  );

  it.effect(
    "describes a route with its counterparts in every locale, and resolves one into another locale",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        expect(
          yield* world.visitor.query(catalog.getMetadata, {
            appLocale: "id",
            kind: "set",
            publicPath: SET_PATH,
          })
        ).toEqual({
          route: {
            alternates: [
              {
                appLocale: "en",
                publicPath: "try-out/indonesia/snbt/2027/set-1-en",
              },
              { appLocale: "id", publicPath: SET_PATH },
              {
                appLocale: "de",
                publicPath: "try-out/indonesia/snbt/2027/set-1-de",
              },
            ],
            publicPath: SET_PATH,
            socialImageIdentity: null,
            title: "Try-out",
          },
        });
        expect(
          yield* world.visitor.query(catalog.getMetadata, {
            appLocale: "en",
            kind: "exam",
            publicPath: "try-out/indonesia/snbt-en",
          })
        ).toMatchObject({
          route: {
            socialImageIdentity: { countryKey: "indonesia", examKey: "snbt" },
          },
        });
        expect(
          yield* world.visitor.query(catalog.getMetadata, {
            appLocale: "id",
            kind: "country",
            publicPath: "try-out/indonesia-id",
          })
        ).toMatchObject({
          route: {
            alternates: [
              { appLocale: "en", publicPath: "try-out/indonesia-en" },
              { appLocale: "id", publicPath: "try-out/indonesia-id" },
              { appLocale: "de", publicPath: "try-out/indonesia-de" },
            ],
            description: "Try-out Indonesia",
          },
        });
        expect(
          yield* world.visitor.query(catalog.getMetadata, {
            appLocale: "id",
            kind: "exam",
            publicPath: SET_PATH,
          })
        ).toEqual({ route: null });
        expect(
          yield* world.visitor.query(catalog.getSetPage, {
            appLocale: "id",
            publicPath: `${SET_PATH}/section-a`,
          })
        ).toBeNull();
        expect(
          yield* world.visitor.query(catalog.getLocalizedPath, {
            currentAppLocale: "id",
            publicPath: `${SET_PATH}/section-a`,
            targetAppLocale: "de",
          })
        ).toBe("try-out/indonesia/snbt/2027/set-1-de/section-a");
        expect(
          yield* world.visitor.query(catalog.getLocalizedPath, {
            currentAppLocale: "id",
            publicPath: "try-out/nowhere",
            targetAppLocale: "de",
          })
        ).toBeNull();
        yield* tamperCatalog(
          world,
          { ...KEYS, appLocale: "de", kind: "set", setKey: "set-1" },
          "delete"
        );
        expect(
          yield* world.visitor.query(catalog.getLocalizedPath, {
            currentAppLocale: "id",
            publicPath: SET_PATH,
            targetAppLocale: "de",
          })
        ).toBeNull();
      })
  );

  it.effect(
    "demonstrates the landing's question with its key and reading, and refuses a release without it",
    () =>
      Effect.gen(function* () {
        const featured = yield* tryoutWorld({
          firstSectionKey: "quantitative-knowledge",
        });
        const question = yield* featured.visitor.query(
          catalog.getFeaturedQuestion,
          { appLocale: "en" }
        );
        expect(
          yield* Schema.decodeEffect(TryoutQuestionBodyText)(question.body)
        ).toMatchObject({
          interaction: { kind: "choice", maxChoices: 1 },
          key: { correct: ["option-2"], kind: "choice" },
          prompt: { type: "doc" },
        });
        const missing = yield* tryoutWorld();
        expect(
          yield* missing.visitor
            .query(catalog.getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("featured section"),
        });
        yield* tamperCatalog(
          missing,
          { ...KEYS, appLocale: "id", kind: "set", setKey: "set-1" },
          "delete"
        );
        expect(
          yield* missing.visitor
            .query(catalog.getFeaturedQuestion, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({ message: expect.stringContaining("featured set") });
      })
  );

  it.effect(
    "fails closed on a route held twice, a node without its parents, a paper without a profile section, and a set without its entry",
    () =>
      Effect.gen(function* () {
        const twice = yield* tryoutWorld();
        yield* tamperCatalog(
          twice,
          { appLocale: "id", countryKey: "indonesia", kind: "country" },
          "duplicate"
        );
        expect(
          yield* twice.visitor
            .query(catalog.getHubPage, { appLocale: "id" })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("held twice"),
        });
        const orphan = yield* tryoutWorld();
        yield* tamperCatalog(
          orphan,
          { appLocale: "id", countryKey: "indonesia", kind: "country" },
          "delete"
        );
        for (const [ref, publicPath] of [
          [catalog.getExamPage, "try-out/indonesia/snbt-id"],
          [catalog.getTrackPage, "try-out/indonesia/snbt/2027-id"],
          [catalog.getSetPage, SET_PATH],
        ] as const) {
          expect(
            yield* orphan.visitor
              .query(ref, { appLocale: "id", publicPath })
              .pipe(Effect.flip)
          ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        }
        for (const [keys, publicPath, lost] of [
          [
            {
              appLocale: "id",
              countryKey: "indonesia",
              examKey: "snbt",
              kind: "exam",
            },
            SET_PATH,
            "exam",
          ],
          [{ ...KEYS, appLocale: "id", kind: "track" }, SET_PATH, "track"],
          [
            { ...KEYS, appLocale: "id", kind: "set", setKey: "set-1" },
            `${SET_PATH}/section-a`,
            "set",
          ],
        ] as const) {
          const broken = yield* tryoutWorld();
          yield* tamperCatalog(broken, keys, "delete");
          expect(
            yield* broken.visitor
              .query(
                keys.kind === "set"
                  ? catalog.getSectionPage
                  : catalog.getSetPage,
                { appLocale: "id", publicPath }
              )
              .pipe(Effect.flip)
          ).toMatchObject({
            message: expect.stringContaining(`lost its ${lost}`),
          });
        }
        const foreign = yield* tryoutWorld();
        yield* foreign.rewrite(
          (row) =>
            row.kind === "catalog" &&
            row.row.kind === "section" &&
            row.row.appLocale === "id" &&
            row.row.sectionKey === "section-b",
          (row) => {
            assert.ok(
              row.kind === "catalog" && row.row.kind === "section",
              "Expected the section row."
            );
            return { ...row, row: { ...row.row, sectionKey: "section-z" } };
          }
        );
        expect(
          yield* foreign.visitor
            .query(catalog.getSetPage, {
              appLocale: "id",
              publicPath: SET_PATH,
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          message: expect.stringContaining("names no section of its profile"),
        });
        const unplaced = yield* tryoutWorld();
        yield* unplaced.rewrite(
          (row) => row.kind === "paper" && row.paper.id === "test-paper-set-1",
          (row) => {
            assert.ok(row.kind === "paper", "Expected the set's paper.");
            const [first] = row.paper.sections;
            return { ...row, paper: { ...row.paper, sections: [first] } };
          }
        );
        expect(
          yield* unplaced.visitor
            .query(catalog.getSetPage, {
              appLocale: "id",
              publicPath: SET_PATH,
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          message: expect.stringContaining("places no section"),
        });
        const entryless = yield* tryoutWorld({ entry: true });
        yield* tamperCatalog(
          entryless,
          {
            ...KEYS,
            appLocale: "id",
            kind: "section",
            sectionKey: "section-a",
            setKey: "set-1",
          },
          "delete"
        );
        expect(
          yield* entryless.visitor
            .query(catalog.getSetPage, {
              appLocale: "id",
              publicPath: SET_PATH,
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          message: expect.stringContaining("no section to enter"),
        });
      })
  );
});
