// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import island from "@repo/backend/confect/_generated/refs/island";
import { isRedirect } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import { islandScreenHandler } from "@/lib/account/island.server";
import { seedOf } from "@/lib/island/noise";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const mocks = vi.hoisted(() => ({
  preloadConfectQuery:
    vi.fn<
      (
        ref: unknown,
        args: unknown,
        token: unknown
      ) => Effect.Effect<unknown, unknown>
    >(),
  readSessionMemo:
    vi.fn<
      (
        request: Request
      ) => Effect.Effect<Effect.Effect<unknown, unknown>, unknown>
    >(),
  scheduleCurrentServerExceptionCapture:
    vi.fn<(error: unknown, properties: unknown) => Effect.Effect<void>>(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/auth/session.server", () => ({
  readSessionMemo: mocks.readSessionMemo,
}));

vi.mock("@/lib/data/preload.server", () => ({
  preloadConfectQuery: mocks.preloadConfectQuery,
}));

vi.mock("@/lib/analytics/exception.server", () => ({
  scheduleCurrentServerExceptionCapture:
    mocks.scheduleCurrentServerExceptionCapture,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scheduleCurrentServerExceptionCapture.mockReturnValue(Effect.void);
});

const account = {
  appUser: { _id: "users-1", username: "nabil" },
  authUser: { name: "Nabil" },
};

/** Answers each Confect query with its value and fails any other query. */
function answerQueries(answers: ReadonlyArray<readonly [unknown, unknown]>) {
  mocks.preloadConfectQuery.mockImplementation((ref) =>
    Option.match(
      Arr.findFirst(answers, ([query]) => query === ref),
      {
        onNone: () => Effect.die("unexpected query"),
        onSome: ([, value]) => Effect.succeed(value),
      }
    )
  );
}

/** The failure that a rejected promise carries, or a test failure when it resolves. */
function failureOf(run: Promise<unknown>) {
  return run.then(
    () => {
      throw new Error("expected a failure");
    },
    (cause: unknown) => cause
  );
}

/** A session read that answers with the given Convex token. */
function sessionWith(token: Option.Option<string>) {
  mocks.readSessionMemo.mockReturnValue(
    Effect.succeed(Effect.succeed({ convexToken: token }))
  );
}

describe("islandScreenHandler", () => {
  it("sends a visitor to sign-in", async () => {
    sessionWith(Option.none());
    const cause = await failureOf(
      islandScreenHandler({ data: { locale: "en" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("opens the learner's level, footprint and seed, with a head kept out of search", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [island.queries.own, { lifetime: 420 }],
      [auth.queries.getCurrentUser, account],
    ]);
    const screen = await islandScreenHandler({ data: { locale: "en" } });
    expect(screen).toMatchObject({
      level: 3,
      lifetime: 420,
      next: 900,
      seed: seedOf("users-1"),
      world: 32,
    });
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en/island",
      indexable: false,
      title: "Island",
    });
  });

  it("starts a learner with no island yet at the first level, past the last level with none next", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [island.queries.own, null],
      [auth.queries.getCurrentUser, null],
    ]);
    const first = await islandScreenHandler({ data: { locale: "id" } });
    expect(first).toMatchObject({
      level: 1,
      lifetime: 0,
      next: 150,
      world: 16,
      seed: seedOf("island"),
    });
    expect(first.seo.title).toBe("Pulau");
    answerQueries([
      [island.queries.own, { lifetime: 9000 }],
      [auth.queries.getCurrentUser, account],
    ]);
    const top = await islandScreenHandler({ data: { locale: "en" } });
    expect(top).toMatchObject({ level: 7, next: undefined, world: 64 });
  });
});
