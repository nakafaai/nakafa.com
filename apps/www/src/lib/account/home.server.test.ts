// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import chats from "@repo/backend/confect/_generated/refs/chats";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { isRedirect } from "@tanstack/react-router";
import { Array as Arr, Effect, Option } from "effect";
import {
  chatScreenHandler,
  chatSidebarScreenHandler,
  notificationsScreenHandler,
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
    answerQueries([[chats.queries.getChatTitle, { title: "Algebra" }]]);
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBe("Algebra");
  });

  it("answers no title when the chat has none", async () => {
    sessionWith(Option.none());
    answerQueries([[chats.queries.getChatTitle, { title: null }]]);
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBeUndefined();
  });

  it("answers not found for an address that names no chat", async () => {
    sessionWith(Option.none());
    answerQueries([[chats.queries.getChatTitle, null]]);
    await expect(
      chatScreenHandler({ data: { id: "abc", locale: "en" } })
    ).rejects.toMatchObject({ isNotFound: true });
  });

  it("reports a title that cannot be read to PostHog and answers without it", async () => {
    sessionWith(Option.some("token"));
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail({ _tag: "PreloadFailed", cause: "unreachable" })
    );
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBeUndefined();
    expect(
      mocks.scheduleCurrentServerExceptionCapture
    ).toHaveBeenCalledExactlyOnceWith(
      { _tag: "PreloadFailed", cause: "unreachable" },
      {
        operation: chats.queries.getChatTitle.convexFunctionName,
        source: "data.readOptional",
      }
    );
  });

  it("answers without a title, and reports nothing, when the viewer may not read it", async () => {
    sessionWith(Option.some("token"));
    mocks.preloadConfectQuery.mockReturnValue(
      Effect.fail({ _tag: "AuthFailure" })
    );
    const screen = await chatScreenHandler({
      data: { id: "chat-1", locale: "en" },
    });
    expect(screen.title).toBeUndefined();
    expect(mocks.scheduleCurrentServerExceptionCapture).not.toHaveBeenCalled();
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
