// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { isRedirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { visitScreenHandler } from "@/lib/account/visit.server";
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

/** Answers the visit query with the given island, and fails any other query. */
function visitAnswers(visited: unknown) {
  mocks.preloadConfectQuery.mockImplementation((ref) =>
    ref === island.queries.visit
      ? Effect.succeed(visited)
      : Effect.die("unexpected query")
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

describe("visitScreenHandler", () => {
  it("sends a visitor who is not signed in to sign-in", async () => {
    sessionWith(Option.none());
    const cause = await failureOf(
      visitScreenHandler({ data: { locale: "en", username: "fox" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("opens a shared island with its owner's seed, level and footprint, kept out of search", async () => {
    sessionWith(Option.some("token"));
    visitAnswers({
      badges: [],
      lifetime: 420,
      owner: "users-2",
      world: [{ block: 5, x: 30, y: 9, z: 30 }],
    });
    const screen = await visitScreenHandler({
      data: { locale: "en", username: "fox" },
    });
    expect(screen.island).toEqual({
      edits: [{ block: 5, x: 30, y: 9, z: 30 }],
      level: 3,
      seed: seedOf("users-2"),
      size: 56,
    });
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en/island/fox",
      indexable: false,
      title: "fox's island",
    });
  });

  it("answers no island when its owner keeps it closed", async () => {
    sessionWith(Option.some("token"));
    visitAnswers(null);
    const screen = await visitScreenHandler({
      data: { locale: "id", username: "fox" },
    });
    expect(screen).toMatchObject({ island: null, username: "fox" });
    expect(screen.seo.title).toBe("Pulau fox");
  });
});
