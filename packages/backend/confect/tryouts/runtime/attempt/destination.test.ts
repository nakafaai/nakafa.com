import { DatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import {
  readAttemptDestination,
  readAttemptSectionForPath,
} from "@repo/backend/confect/tryouts/runtime/attempt/destination";
import { api } from "@repo/backend/convex/_generated/api";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { Array as Arr, Effect } from "effect";

const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;
const englishSetPath = `${setPath}-english`;
const englishSectionPath = `${englishSetPath}/mathematics`;

describe("retained attempt navigation", () => {
  it("uses the localized archived route for navigation and reactive resume state", async () => {
    vi.setSystemTime(TRYOUT_START_NOW);
    const t = createConvexTestWithBetterAuth();
    const owner = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "localized-resume",
      });
      const catalog = Arr.flatMap(["id", "en"], (locale) =>
        Arr.map(
          makeTryoutStartHierarchy(locale === "id" ? "id" : "en", "visible"),
          (row) => {
            if (row.appLocale !== "en") {
              return row;
            }
            if (row.kind === "set") {
              return {
                ...row,
                publicPath: PublicPathSchema.make(englishSetPath),
              };
            }
            if (row.kind === "section") {
              return {
                ...row,
                publicPath: PublicPathSchema.make(englishSectionPath),
              };
            }
            return row;
          }
        )
      );
      const snapshotId = await activateTryoutSnapshot(ctx, {
        catalog,
        placements: [
          makeTryoutStartPlacement("id"),
          makeTryoutStartPlacement("en"),
        ],
      });
      await insertTestTryoutRuntimeBundle(ctx, snapshotId);
      return identity;
    });
    const client = t.withIdentity({
      subject: owner.authUserId,
      sessionId: owner.sessionId,
    });
    const started = await client.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        trackKey: TRYOUT_START_TRACK,
        setKey: TRYOUT_START_SET,
        locale: "id",
      }
    );
    await t.query(async (ctx) => {
      const attempt = await ctx.db.get(started.attemptId);
      assert.isNotNull(attempt);
      await Effect.runPromise(
        Effect.gen(function* () {
          expect(yield* readAttemptDestination(attempt, "id")).toBe(setPath);
          expect(
            yield* readAttemptDestination(attempt, "id", TRYOUT_START_SECTION)
          ).toBe(sectionPath);
          expect(
            yield* readAttemptDestination(attempt, "id", "missing")
          ).toBeNull();
          expect(yield* readAttemptDestination(attempt, "en")).toBe(
            englishSetPath
          );
          expect(
            yield* readAttemptDestination(attempt, "en", TRYOUT_START_SECTION)
          ).toBe(englishSectionPath);
          expect(
            yield* readAttemptDestination(attempt, "en", "missing")
          ).toBeNull();
          expect(yield* readAttemptDestination(attempt, "de")).toBeNull();
          for (const path of [sectionPath, englishSectionPath]) {
            expect(
              yield* readAttemptSectionForPath(attempt, "en", path)
            ).toEqual(attempt.sectionSnapshots[0]);
          }
          for (const path of [englishSetPath, "missing"]) {
            expect(
              yield* readAttemptSectionForPath(attempt, "en", path)
            ).toBeNull();
          }
          for (const field of [
            "countryKey",
            "examKey",
            "trackKey",
            "setKey",
          ] as const) {
            expect(
              yield* readAttemptSectionForPath(
                { ...attempt, [field]: "another" },
                "en",
                englishSectionPath
              )
            ).toBeNull();
          }
          expect(
            yield* readAttemptSectionForPath(
              { ...attempt, sectionSnapshots: [] },
              "en",
              englishSectionPath
            )
          ).toBeNull();
        }).pipe(Effect.provide(DatabaseReader.layer(confectSchema, ctx.db)))
      );
    });
    const english = await client.query(
      api.tryouts.queries.runtime.getSetAttemptState,
      { attemptId: started.attemptId, locale: "en" }
    );
    expect(english?.attempt.resumeSectionPublicPath).toBe(englishSectionPath);
    const retained = await client.query(
      api.tryouts.queries.attemptPage.getSection,
      {
        request: {
          kind: "retained",
          attemptId: started.attemptId,
          locale: "en",
          publicPath: englishSectionPath,
        },
      }
    );
    expect(retained).toMatchObject({
      kind: "retained",
      page: { section: { publicPath: englishSectionPath } },
    });
  });
});
