// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import billing from "@repo/backend/confect/_generated/refs/billing";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { isNotFound } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  learningScreenHandler,
  memoryScreenHandler,
  settingsScreenHandler,
  subscriptionsScreenHandler,
} from "@/lib/account/settings.server";

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

beforeEach(() => {
  vi.clearAllMocks();
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

describe("settingsScreenHandler", () => {
  it("answers the account and the settings head", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[auth.queries.getCurrentUser, account]]);
    const screen = await settingsScreenHandler({ data: { locale: "en" } });
    expect(screen.account).toEqual(account);
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en",
      indexable: false,
    });
  });

  it("ends the request as not found when the account is gone", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[auth.queries.getCurrentUser, null]]);
    const cause = await failureOf(
      settingsScreenHandler({ data: { locale: "en" } })
    );
    expect(isNotFound(cause)).toBe(true);
  });
});

describe("learningScreenHandler", () => {
  it("answers the account, the preference and the curriculum programs", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [auth.queries.getCurrentUser, account],
      [learningPreferences.queries.getCurrent, { curriculum: "k12" }],
      [learningPreferences.queries.listCurriculumPrograms, ["math"]],
    ]);
    const screen = await learningScreenHandler({ data: { locale: "en" } });
    expect(screen).toMatchObject({
      account,
      preference: { curriculum: "k12" },
      programs: ["math"],
      seo: { canonicalPath: "/en", indexable: false },
    });
  });

  it("ends the request as not found when the account is gone", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [auth.queries.getCurrentUser, null],
      [learningPreferences.queries.getCurrent, null],
      [learningPreferences.queries.listCurriculumPrograms, []],
    ]);
    const cause = await failureOf(
      learningScreenHandler({ data: { locale: "en" } })
    );
    expect(isNotFound(cause)).toBe(true);
  });
});

describe("memoryScreenHandler", () => {
  it("answers the first page of memories, whether memory is paused and the moment of the read", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [nina.memory.list, { page: ["memory-1"] }],
      [nina.memory.state, { paused: true }],
    ]);
    const screen = await memoryScreenHandler({ data: { locale: "en" } });
    expect(screen).toMatchObject({
      first: { page: ["memory-1"] },
      paused: true,
      seo: { canonicalPath: "/en", indexable: false },
    });
    expect(typeof screen.now).toBe("number");
  });

  it("ends the request as not found when the memory state is gone", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [nina.memory.list, { page: [] }],
      [nina.memory.state, null],
    ]);
    const cause = await failureOf(
      memoryScreenHandler({ data: { locale: "en" } })
    );
    expect(isNotFound(cause)).toBe(true);
  });
});

describe("subscriptionsScreenHandler", () => {
  it("answers the billing overview of the visitor and the head", async () => {
    sessionWith(Option.some("token"));
    const overview = {
      credits: {
        allowance: 10,
        balance: 10,
        lots: { balance: 0, expiresAt: null },
        pool: null,
        resetAt: 1_792_000_000_000,
      },
      plan: "free",
      pass: null,
      subscription: null,
    };
    answerQueries([[billing.queries.overview, overview]]);
    const screen = await subscriptionsScreenHandler({ data: { locale: "en" } });
    expect(screen).toMatchObject({
      overview,
      seo: { canonicalPath: "/en", indexable: false },
    });
  });
});
