// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import posts from "@repo/backend/confect/_generated/refs/posts";
import users from "@repo/backend/confect/_generated/refs/users";
import { isNotFound } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  profileChatHandler,
  profileCommentsHandler,
  profilePostsHandler,
  profileScreenHandler,
} from "@/lib/account/profile.server";

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

describe("profileScreenHandler", () => {
  it("answers the profile and whether the visitor owns it", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, ownerAccount],
    ]);
    await expect(
      profileScreenHandler({ data: { locale: "en", username: "nabil" } })
    ).resolves.toEqual({ isOwner: true, profile });
  });

  it("ends the request as not found when the profile is gone", async () => {
    sessionWith(Option.none());
    answerQueries([[users.queries.getProfileByUsername, null]]);
    const cause = await failureOf(
      profileScreenHandler({ data: { locale: "en", username: "nobody" } })
    );
    expect(isNotFound(cause)).toBe(true);
  });
});

describe("profilePostsHandler", () => {
  it("answers the first page of posts, the moment of the read and the Posts head", async () => {
    sessionWith(Option.none());
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [posts.queries.list, { page: ["post-1"] }],
    ]);
    const screen = await profilePostsHandler({
      data: { locale: "en", username: "Nabil" },
    });
    expect(screen.first).toEqual({ page: ["post-1"] });
    expect(typeof screen.now).toBe("number");
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en/@nabil",
      indexable: false,
    });
  });

  it("answers no first page when the posts cannot be read, so the live list loads them", async () => {
    sessionWith(Option.none());
    mocks.preloadConfectQuery.mockImplementation((ref) =>
      ref === posts.queries.list
        ? Effect.fail({ _tag: "PreloadFailed", cause: "unreachable" })
        : Effect.succeed(profile)
    );
    const screen = await profilePostsHandler({
      data: { locale: "en", username: "nabil" },
    });
    expect(screen.first).toBeNull();
  });
});

describe("profileChatHandler", () => {
  it("answers the chat head and the owner's id to the owner", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, ownerAccount],
    ]);
    const screen = await profileChatHandler({
      data: { locale: "en", username: "nabil" },
    });
    expect(screen).toMatchObject({
      seo: { canonicalPath: "/en/@nabil/chat", indexable: false },
      userId: "users-owner",
    });
  });

  it("ends the request as not found for anyone else", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [auth.queries.getCurrentUser, otherAccount],
    ]);
    const cause = await failureOf(
      profileChatHandler({ data: { locale: "en", username: "nabil" } })
    );
    expect(isNotFound(cause)).toBe(true);
  });
});

describe("profileCommentsHandler", () => {
  it("answers the first page of comments, the Comments head and the owner's id", async () => {
    sessionWith(Option.none());
    answerQueries([
      [users.queries.getProfileByUsername, profile],
      [comments.queries.getCommentsByUserId, { page: ["comment-1"] }],
    ]);
    const screen = await profileCommentsHandler({
      data: { locale: "en", username: "nabil" },
    });
    expect(screen).toMatchObject({
      first: { page: ["comment-1"] },
      seo: { canonicalPath: "/en/@nabil/comments", indexable: false },
      userId: "users-owner",
    });
  });
});
