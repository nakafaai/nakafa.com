// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import contents from "@repo/backend/confect/_generated/refs/contents";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import { isRedirect } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  chatIndexScreenHandler,
  chatScreenHandler,
  chatSidebarScreenHandler,
  homeScreenHandler,
  notificationsScreenHandler,
  searchScreenHandler,
} from "@/lib/account/home.server";

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
  readRequestSession:
    vi.fn<(request: Request) => Effect.Effect<unknown, unknown>>(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/auth/session.server", () => ({
  readRequestSession: mocks.readRequestSession,
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
  mocks.readRequestSession.mockReturnValue(
    Effect.succeed({ convexToken: token })
  );
}

describe("homeScreenHandler", () => {
  it("sends a visitor to sign-in", async () => {
    sessionWith(Option.none());
    const cause = await failureOf(
      homeScreenHandler({ data: { locale: "en" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("sends a signed-in visitor who is not authenticated to sign-in", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [
        onboarding.queries.getStatus,
        { isAuthenticated: false, isRequired: false },
      ],
    ]);
    const cause = await failureOf(
      homeScreenHandler({ data: { locale: "en" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("sends a learner who must finish onboarding to the onboarding page", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [
        onboarding.queries.getStatus,
        { isAuthenticated: true, isRequired: true },
      ],
    ]);
    const cause = await failureOf(
      homeScreenHandler({ data: { locale: "en" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("answers the home screen with the account name and the recent subjects", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [
        onboarding.queries.getStatus,
        { isAuthenticated: true, isRequired: false },
      ],
      [auth.queries.getCurrentUser, account],
      [contents.queries.recent.getRecentlyViewed, ["math"]],
    ]);
    const screen = await homeScreenHandler({ data: { locale: "en" } });
    expect(screen.name).toBe("Nabil");
    expect(screen.recentRows).toEqual(["math"]);
    expect(screen.seo).toMatchObject({ canonicalPath: "/en", indexable: true });
  });

  it("answers the home screen without a name when the account is gone", async () => {
    sessionWith(Option.some("token"));
    answerQueries([
      [
        onboarding.queries.getStatus,
        { isAuthenticated: true, isRequired: false },
      ],
      [auth.queries.getCurrentUser, null],
      [contents.queries.recent.getRecentlyViewed, []],
    ]);
    const screen = await homeScreenHandler({ data: { locale: "en" } });
    expect(screen.name).toBeNull();
  });
});

describe("chatIndexScreenHandler", () => {
  it("answers the new chat head with its canonical address", async () => {
    const screen = await chatIndexScreenHandler({ data: { locale: "en" } });
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en/chat",
      indexable: true,
    });
  });
});

describe("chatSidebarScreenHandler", () => {
  it("reads no chats for a visitor", async () => {
    sessionWith(Option.none());
    await expect(
      chatSidebarScreenHandler({ data: undefined })
    ).resolves.toEqual({
      first: undefined,
    });
    expect(mocks.preloadConfectQuery).not.toHaveBeenCalled();
  });

  it("reads the first page of the study chats of a signed-in visitor", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[chats.queries.getOwnChats, { page: ["chat-1"] }]]);
    await expect(
      chatSidebarScreenHandler({ data: undefined })
    ).resolves.toEqual({
      first: { page: ["chat-1"] },
    });
  });
});

describe("chatScreenHandler", () => {
  it("answers the title of a chat that the visitor may read", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[chats.queries.getChatTitle, "Algebra"]]);
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBe("Algebra");
  });

  it("answers no title when the chat has none", async () => {
    sessionWith(Option.none());
    answerQueries([[chats.queries.getChatTitle, null]]);
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBeUndefined();
  });

  it("logs a title that cannot be read and answers without it", async () => {
    sessionWith(Option.some("token"));
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail({ _tag: "PreloadFailed", cause: "unreachable" })
    );
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBeUndefined();
  });
});

describe("searchScreenHandler", () => {
  it("answers the search head for a visitor without a name", async () => {
    sessionWith(Option.none());
    const screen = await searchScreenHandler({ data: { locale: "en" } });
    expect(screen).toMatchObject({
      name: null,
      seo: { canonicalPath: "/en/search", indexable: true },
    });
    expect(mocks.preloadConfectQuery).not.toHaveBeenCalled();
  });

  it("answers the name of a signed-in visitor", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[auth.queries.getCurrentUser, account]]);
    const screen = await searchScreenHandler({ data: { locale: "en" } });
    expect(screen.name).toBe("Nabil");
  });

  it("answers without a name when the signed-in account is gone", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[auth.queries.getCurrentUser, null]]);
    const screen = await searchScreenHandler({ data: { locale: "en" } });
    expect(screen.name).toBeNull();
  });
});

describe("notificationsScreenHandler", () => {
  it("sends a visitor to sign-in", async () => {
    sessionWith(Option.none());
    const cause = await failureOf(
      notificationsScreenHandler({ data: { locale: "en" } })
    );
    expect(isRedirect(cause)).toBe(true);
  });

  it("reads the first page of the inbox and a noindex head", async () => {
    sessionWith(Option.some("token"));
    answerQueries([[notifications.inbox.list, { page: ["note-1"] }]]);
    const screen = await notificationsScreenHandler({ data: { locale: "en" } });
    expect(screen.first).toEqual({ page: ["note-1"] });
    expect(screen.seo).toMatchObject({
      canonicalPath: "/en",
      indexable: false,
    });
  });
});
