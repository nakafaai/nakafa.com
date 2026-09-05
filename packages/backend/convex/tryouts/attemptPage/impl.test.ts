import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import { Effect } from "effect";

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
  vi.setSystemTime(new Date(TRYOUT_START_NOW));
  const t = createConvexTestWithBetterAuth();
  const auth = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "attempt-page-integrity",
      });
      await seedTryoutStartSet(ctx, { userId: user.userId, visibility });
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
    "does not expose a retained attempt under another locale, path, ID, or owner",
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
          { ...setRequest, locale: "en" as const },
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
          { ...sectionRequest, locale: "en" as const },
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
});
