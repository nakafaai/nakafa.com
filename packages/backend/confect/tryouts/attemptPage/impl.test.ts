import { DatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { readAttemptSetPage } from "@repo/backend/confect/tryouts/runtime/attempt/page";
import { api } from "@repo/backend/convex/_generated/api";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { Effect } from "effect";

const readTryoutHistoryMock = vi.hoisted(() => vi.fn());
vi.mock(
  "@repo/backend/confect/tryouts/runtime/history/read",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/confect/tryouts/runtime/history/read")
    >()),
    readTryoutHistory: readTryoutHistoryMock,
  })
);

const identity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const setPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;

const startFixture = Effect.fn("attemptPage.test.startFixture")(function* (
  visibility: "internal-entry" | "visible"
) {
  vi.setSystemTime(TRYOUT_START_NOW);
  const t = createConvexTestWithBetterAuth();
  const auth = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "attempt-page-integrity",
      });
      await activateTryoutStartSource(ctx, visibility, "raw");
      return user;
    })
  );
  const client = t.withIdentity({
    subject: auth.authUserId,
    sessionId: auth.sessionId,
  });
  const started = yield* Effect.promise(() =>
    client.mutation(api.tryouts.mutations.attempts.startAttempt, identity)
  );
  return { client, started, t };
});

describe("attempt page authorization and frozen routes", () => {
  it.effect(
    "does not substitute current content for a missing retained language",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { client, started, t } = yield* startFixture("visible");
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("tryoutCatalog").collect();
            for (const row of rows) {
              if (row.appLocale === "en") {
                await ctx.db.delete(row._id);
              }
            }
          })
        );
        const current = {
          ...identity,
          kind: "current" as const,
          locale: "en" as const,
        };
        const retained = {
          kind: "retained" as const,
          attemptId: started.attemptId,
          locale: "en" as const,
        };
        for (const request of [current, { ...retained, publicPath: setPath }]) {
          expect(
            yield* Effect.promise(() =>
              client.query(api.tryouts.queries.attemptPage.getSet, { request })
            )
          ).toBeNull();
        }
        for (const request of [
          { ...current, sectionKey: TRYOUT_START_SECTION },
          { ...retained, publicPath: sectionPath },
        ]) {
          expect(
            yield* Effect.promise(() =>
              client.query(api.tryouts.queries.attemptPage.getSection, {
                request,
              })
            )
          ).toBeNull();
        }
        yield* Effect.promise(() =>
          expect(
            client.mutation(api.tryouts.mutations.attempts.startAttempt, {
              ...identity,
              locale: "en",
              destinationSectionKey: TRYOUT_START_SECTION,
            })
          ).rejects.toMatchObject({
            data: {
              code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
              message: "The retained exam has no destination in this language.",
            },
          })
        );
        yield* Effect.promise(() =>
          t.query(async (ctx) => {
            const attempt = await ctx.db.get(started.attemptId);
            assert.isNotNull(attempt);
            await expect(
              Effect.runPromiseWith(runtimeServices)(
                readAttemptSetPage(
                  { locale: "en", publicPath: setPath },
                  attempt,
                  identity
                ).pipe(
                  Effect.provide(DatabaseReader.layer(confectSchema, ctx.db))
                )
              )
            ).rejects.toMatchObject({
              code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
              message: "The retained exam has no page in this language.",
            });
          })
        );
      })
  );
  it.effect(
    "returns no set overlay for anonymous readers or an unattempted set",
    () =>
      Effect.gen(function* () {
        const { client, t } = yield* startFixture("visible");
        const request = { kind: "current" as const, ...identity };
        expect(
          yield* Effect.promise(() =>
            t.query(api.tryouts.queries.attemptPage.getSet, { request })
          )
        ).toBeNull();
        expect(
          yield* Effect.promise(() =>
            client.query(api.tryouts.queries.attemptPage.getSet, {
              request: { ...request, setKey: "unattempted" },
            })
          )
        ).toBeNull();
        expect(
          yield* Effect.promise(() =>
            client.query(api.tryouts.queries.attemptPage.getSection, {
              request: { ...request, sectionKey: "missing" },
            })
          )
        ).toBeNull();
      })
  );

  it.effect(
    "does not expose a retained attempt under another path, ID, or owner",
    () =>
      Effect.gen(function* () {
        const { client, started, t } = yield* startFixture("visible");
        const setRequest = {
          attemptId: started.attemptId,
          kind: "retained" as const,
          locale: "id" as const,
          publicPath: setPath,
        };
        const sectionRequest = { ...setRequest, publicPath: sectionPath };
        for (const request of [
          { ...setRequest, publicPath: `${setPath}-other` },
          { ...setRequest, attemptId: "not-an-id" },
        ]) {
          expect(
            yield* Effect.promise(() =>
              client.query(api.tryouts.queries.attemptPage.getSet, { request })
            )
          ).toBeNull();
        }
        for (const request of [
          { ...sectionRequest, publicPath: `${sectionPath}-other` },
          { ...sectionRequest, attemptId: "not-an-id" },
        ]) {
          expect(
            yield* Effect.promise(() =>
              client.query(api.tryouts.queries.attemptPage.getSection, {
                request,
              })
            )
          ).toBeNull();
        }
        const other = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "other-attempt-reader",
            })
          )
        );
        const otherClient = t.withIdentity({
          subject: other.authUserId,
          sessionId: other.sessionId,
        });
        expect(
          yield* Effect.promise(() =>
            otherClient.query(api.tryouts.queries.attemptPage.getSet, {
              request: setRequest,
            })
          )
        ).toBeNull();
        expect(
          yield* Effect.promise(() =>
            otherClient.query(api.tryouts.queries.attemptPage.getSection, {
              request: sectionRequest,
            })
          )
        ).toBeNull();
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete(started.attemptId))
        );
        expect(
          yield* Effect.promise(() =>
            client.query(api.tryouts.queries.attemptPage.getSet, {
              request: setRequest,
            })
          )
        ).toBeNull();
        expect(
          yield* Effect.promise(() =>
            client.query(api.tryouts.queries.attemptPage.getSection, {
              request: sectionRequest,
            })
          )
        ).toBeNull();
        yield* Effect.promise(() =>
          expect(
            client.query(api.tryouts.queries.attemptPage.getSet, {
              request: { ...identity, kind: "current" },
            })
          ).rejects.toMatchObject({
            data: { code: "TRYOUT_PROGRESS_ATTEMPT_MISMATCH" },
          })
        );
      })
  );

  it.effect(
    "does not redirect a private entry section to an invented public URL",
    () =>
      Effect.gen(function* () {
        const { client } = yield* startFixture("internal-entry");
        expect(
          yield* Effect.promise(() =>
            client.query(api.tryouts.queries.attemptPage.getSection, {
              request: {
                ...identity,
                kind: "current",
                sectionKey: TRYOUT_START_SECTION,
              },
            })
          )
        ).toBeNull();
      })
  );

  it.effect(
    "answers a running section without bodies when its content is not signed",
    () =>
      Effect.gen(function* () {
        const { client, started } = yield* startFixture("visible");
        const request = {
          ...identity,
          kind: "current" as const,
          sectionKey: TRYOUT_START_SECTION,
        };
        const [section, redirected] = yield* Effect.promise(() =>
          Promise.all([
            client.query(api.tryouts.queries.attemptPage.getSectionWithBodies, {
              request,
            }),
            client.query(api.tryouts.queries.attemptPage.getSection, {
              request,
            }),
          ])
        );
        expect(redirected).toMatchObject({
          attemptId: started.attemptId,
          kind: "redirect",
        });
        expect(section).toMatchObject({
          attempt: {
            attemptId: started.attemptId,
            kind: "retained",
            page: { section: { sectionKey: TRYOUT_START_SECTION } },
          },
        });
        expect(section?.bodies).toEqual([]);
      })
  );

  it.effect(
    "keeps a running section with its bodies private to its owner",
    () =>
      Effect.gen(function* () {
        const { started, t } = yield* startFixture("visible");
        const other = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "other-section-bodies",
            })
          )
        );
        const otherClient = t.withIdentity({
          subject: other.authUserId,
          sessionId: other.sessionId,
        });
        expect(
          yield* Effect.promise(() =>
            otherClient.query(
              api.tryouts.queries.attemptPage.getSectionWithBodies,
              {
                request: {
                  attemptId: started.attemptId,
                  kind: "retained",
                  locale: "id",
                  publicPath: sectionPath,
                },
              }
            )
          )
        ).toBeNull();
      })
  );

  it.effect(
    "answers a running section with the signed bodies its history read returns",
    () =>
      Effect.gen(function* () {
        const { client, started } = yield* startFixture("visible");
        yield* Effect.promise(() =>
          client.mutation(api.tryouts.mutations.sections.start, {
            attemptId: started.attemptId,
            sectionKey: TRYOUT_START_SECTION,
          })
        );
        const body = {
          bundleJson: "bundle",
          items: [],
          rendererJson: "renderer",
        };
        readTryoutHistoryMock.mockReturnValue(Effect.succeed(body));
        const page = yield* Effect.promise(() =>
          client.query(api.tryouts.queries.attemptPage.getSectionWithBodies, {
            request: {
              ...identity,
              kind: "current",
              sectionKey: TRYOUT_START_SECTION,
            },
          })
        );
        expect(page?.bodies).toEqual([body]);
        expect(readTryoutHistoryMock).toHaveBeenCalledExactlyOnceWith({
          attemptId: started.attemptId,
          selectors: expect.any(Array),
        });
      })
  );
});
