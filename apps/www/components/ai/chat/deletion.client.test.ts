import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { Effect, Fiber, Result, Schema } from "effect";
import { TestClock } from "effect/testing";
import { deleteOnPress } from "@/components/ai/chat/deletion.client";

const mocks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Fx.sync(() => mocks.report(error, properties)),
  };
});

type Deletion = Parameters<typeof deleteOnPress>[0];
type Client = Deletion["convex"];
type Reading = ReturnType<Client["connectionState"]>;

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");

/** The state a Convex client reports with its socket up or down. */
function reading(connected: boolean): Reading {
  return {
    connectionCount: 1,
    connectionRetries: 0,
    hasEverConnected: true,
    hasInflightRequests: false,
    inflightActions: 0,
    inflightMutations: 0,
    isWebSocketConnected: connected,
    timeOfOldestInflightRequest: null,
  };
}

/** A Convex client whose socket the test brings up, as the wait reads it. */
function client(connected: boolean) {
  let state = reading(connected);
  let notify = (_next: Reading) => undefined;
  return {
    connect: () => {
      state = reading(true);
      notify(state);
    },
    connectionState: () => state,
    subscribeToConnectionState: (callback: (next: Reading) => undefined) => {
      notify = callback;
      return () => undefined;
    },
  };
}

/**
 * One press of Delete on the chat, with the page's actions as spies. The learner
 * still reads the chat unless `stillOnChat` says otherwise.
 */
function pressOn(
  convex: Client,
  deleteChat: Deletion["deleteChat"],
  stillOnChat: () => boolean = () => true
) {
  const page = {
    close: vi.fn(),
    deleted: vi.fn(),
    leave: vi.fn(),
    refused: vi.fn(),
  };
  return {
    deletion: { chatId, convex, deleteChat, stillOnChat, ...page },
    page,
  };
}

describe("deleteOnPress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.effect(
    "closes the dialog and leaves the chat at the press, before a socket that is down connects",
    () =>
      Effect.gen(function* () {
        const convex = client(false);
        const deleteChat = vi.fn<Deletion["deleteChat"]>();
        deleteChat.mockResolvedValue(Result.succeed(null));
        const { deletion, page } = pressOn(convex, deleteChat);

        const fiber = yield* Effect.forkChild(deleteOnPress(deletion));
        yield* TestClock.adjust("1 second");

        expect(page.close).toHaveBeenCalledOnce();
        expect(page.leave).toHaveBeenCalledOnce();
        expect(deleteChat).not.toHaveBeenCalled();

        convex.connect();
        yield* Fiber.join(fiber);

        expect(deleteChat).toHaveBeenCalledExactlyOnceWith({ chatId });
        expect(page.deleted).toHaveBeenCalledOnce();
        expect(page.refused).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "keeps the learner on the page they moved to when the server deletes a chat they have left",
    () =>
      Effect.gen(function* () {
        const deleteChat = vi.fn<Deletion["deleteChat"]>();
        deleteChat.mockResolvedValue(Result.succeed(null));
        const { deletion, page } = pressOn(
          client(true),
          deleteChat,
          () => false
        );

        yield* deleteOnPress(deletion);

        expect(deleteChat).toHaveBeenCalledExactlyOnceWith({ chatId });
        expect(page.deleted).not.toHaveBeenCalled();
        expect(page.refused).not.toHaveBeenCalled();
      })
  );

  it.effect("sends the delete at once while the socket is connected", () =>
    Effect.gen(function* () {
      const deleteChat = vi.fn<Deletion["deleteChat"]>();
      deleteChat.mockResolvedValue(Result.succeed(null));
      const { deletion, page } = pressOn(client(true), deleteChat);

      yield* deleteOnPress(deletion);

      expect(page.leave).toHaveBeenCalledOnce();
      expect(deleteChat).toHaveBeenCalledExactlyOnceWith({ chatId });
      expect(page.deleted).toHaveBeenCalledOnce();
      expect(page.refused).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "tells the page the delete did not happen when the server refuses it",
    () =>
      Effect.gen(function* () {
        const deleteChat = vi.fn<Deletion["deleteChat"]>();
        deleteChat.mockResolvedValue(
          Result.fail(
            new ChatAccessError({
              code: "CHAT_NOT_FOUND",
              message: "Refused by the test.",
            })
          )
        );
        const { deletion, page } = pressOn(client(true), deleteChat);

        yield* deleteOnPress(deletion);

        expect(page.leave).toHaveBeenCalledOnce();
        expect(page.refused).toHaveBeenCalledOnce();
        expect(page.deleted).not.toHaveBeenCalled();
        expect(mocks.report).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "tells the page the delete did not happen when no socket carries it in five seconds",
    () =>
      Effect.gen(function* () {
        const deleteChat = vi.fn<Deletion["deleteChat"]>();
        const { deletion, page } = pressOn(client(false), deleteChat);

        const fiber = yield* Effect.forkChild(deleteOnPress(deletion));
        yield* TestClock.adjust("5 seconds");
        yield* Fiber.join(fiber);

        expect(deleteChat).not.toHaveBeenCalled();
        expect(page.leave).toHaveBeenCalledOnce();
        expect(page.refused).toHaveBeenCalledOnce();
        expect(page.deleted).not.toHaveBeenCalled();
      })
  );
});
