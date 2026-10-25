// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  accountHandler,
  admitAccount,
  messagesFor,
  readProfileOrNotFound,
  readToken,
} from "@/lib/account/access.server";
import { runServerEffect } from "@/lib/server/fn";

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

const profile = { _id: "users-owner", username: "nabil" };
const ownerAccount = {
  appUser: { _id: "users-owner", username: "nabil" },
  authUser: { name: "Nabil" },
};
const otherAccount = {
  appUser: { _id: "users-other", username: "other" },
  authUser: { name: "Other" },
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

describe("readToken", () => {
  it("reads the Convex token of a signed-in session", async () => {
    sessionWith(Option.some("token"));
    await expect(runServerEffect(readToken())).resolves.toBe("token");
  });

  it("reads no token for a visitor", async () => {
    sessionWith(Option.none());
    await expect(runServerEffect(readToken())).resolves.toBeUndefined();
  });
});

describe("admitAccount", () => {
  it("admits a signed-in visitor with the Convex token", async () => {
    sessionWith(Option.some("token"));
    await expect(runServerEffect(admitAccount("en"))).resolves.toBe("token");
  });

  it("sends a visitor to sign-in with a redirect", async () => {
    sessionWith(Option.none());
    const cause = await failureOf(admitAccount("en").pipe(runServerEffect));
    expect(isRedirect(cause)).toBe(true);
  });
});

describe("accountHandler", () => {
  it("marks the response private and answers with the effect's value", async () => {
    const handler = accountHandler((data: { readonly value: string }) =>
      Effect.succeed(data.value)
    );
    await expect(handler({ data: { value: "answer" } })).resolves.toBe(
      "answer"
    );
    expect(mocks.setResponseHeader).toHaveBeenCalledWith(
      "cache-control",
      "private, no-store"
    );
  });

  it("passes a redirect or not-found defect of the effect on unchanged", async () => {
    const handler = accountHandler(() =>
      Effect.die(new Error("the defect of the effect"))
    );
    const cause = await failureOf(handler({ data: {} }));
    expect(cause).toEqual(new Error("the defect of the effect"));
  });
});

describe("messagesFor", () => {
  it("reads the messages of one locale on the server", async () => {
    const messages = await runServerEffect(messagesFor("en"));
    expect(messages).toHaveProperty("Auth");
  });
});

describe("readProfileOrNotFound", () => {
  it("ends the request as not found when nobody holds the username", async () => {
    answerQueries([[users.queries.getProfileByUsername, null]]);
    const cause = await failureOf(
      readProfileOrNotFound("Nobody", undefined).pipe(runServerEffect)
    );
    expect(isNotFound(cause)).toBe(true);
  });

  it("reads a profile for a visitor, which is nobody's own profile", async () => {
    answerQueries([[users.queries.getProfileByUsername, profile]]);
    await expect(
      runServerEffect(readProfileOrNotFound("Nabil", undefined))
    ).resolves.toEqual({ isOwner: false, profile });
  });

  it("marks the profile of the signed-in owner as their own", async () => {
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, ownerAccount],
    ]);
    await expect(
      runServerEffect(readProfileOrNotFound("nabil", "token"))
    ).resolves.toEqual({ isOwner: true, profile });
  });

  it("does not mark another account's profile as the owner's", async () => {
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, otherAccount],
    ]);
    await expect(
      runServerEffect(readProfileOrNotFound("nabil", "token"))
    ).resolves.toEqual({ isOwner: false, profile });
  });

  it("treats a signed-in token without an account as a visitor", async () => {
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, null],
    ]);
    await expect(
      runServerEffect(readProfileOrNotFound("nabil", "token"))
    ).resolves.toEqual({ isOwner: false, profile });
  });
});
