import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
  ConvexOfflineError,
  isConvexOffline,
  requireConvexOnline,
} from "@/lib/convex/online";

type ConnectionState = Parameters<typeof isConvexOffline>[0];
type Reading = Pick<
  ConnectionState,
  "connectionCount" | "connectionRetries" | "isWebSocketConnected"
>;

const CONNECTED: Reading = {
  connectionCount: 1,
  connectionRetries: 0,
  isWebSocketConnected: true,
};
const DROPPED: Reading = {
  connectionCount: 1,
  connectionRetries: 0,
  isWebSocketConnected: false,
};

/** Builds a connection state whose fields the rule does not read are at rest. */
function connection(state: Reading): ConnectionState {
  return {
    ...state,
    hasEverConnected: state.connectionCount > 0,
    hasInflightRequests: false,
    inflightActions: 0,
    inflightMutations: 0,
    timeOfOldestInflightRequest: null,
  };
}

/** Builds the part of the Convex client the guard reads, with a way to change its state. */
function client(initial: Reading) {
  let state = connection(initial);
  let subscribers = 0;
  let notify = (_state: ConnectionState) => undefined;
  return {
    change: (next: Reading) => {
      state = connection(next);
      notify(state);
    },
    connectionState: () => state,
    subscribers: () => subscribers,
    subscribeToConnectionState: (
      callback: (state: ConnectionState) => undefined
    ) => {
      subscribers += 1;
      notify = callback;
      return () => {
        subscribers -= 1;
      };
    },
  };
}

describe("Convex online state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: "before the first attempt, not connected",
      state: {
        connectionCount: 0,
        connectionRetries: 0,
        isWebSocketConnected: false,
      },
      offline: false,
    },
    {
      name: "connected without an earlier attempt",
      state: {
        connectionCount: 0,
        connectionRetries: 0,
        isWebSocketConnected: true,
      },
      offline: false,
    },
    {
      name: "connected after one connection",
      state: CONNECTED,
      offline: false,
    },
    {
      name: "not connected after one connection",
      state: DROPPED,
      offline: true,
    },
    {
      name: "not connected after one failed attempt",
      state: {
        connectionCount: 0,
        connectionRetries: 1,
        isWebSocketConnected: false,
      },
      offline: true,
    },
  ])("is offline when $name: $offline", ({ state, offline }) => {
    expect(isConvexOffline(connection(state))).toBe(offline);
  });

  it.effect("lets a call start at once while the socket is connected", () =>
    Effect.gen(function* () {
      const convex = client(CONNECTED);

      yield* requireConvexOnline(convex);

      expect(convex.subscribers()).toBe(0);
    })
  );

  it.effect("waits for the first connection before a call starts", () =>
    Effect.gen(function* () {
      const convex = client({
        connectionCount: 0,
        connectionRetries: 0,
        isWebSocketConnected: false,
      });
      const fiber = yield* Effect.forkChild(requireConvexOnline(convex));
      yield* TestClock.adjust("1 second");
      expect(fiber.pollUnsafe()).toBeUndefined();

      convex.change(CONNECTED);
      yield* Fiber.join(fiber);

      expect(convex.subscribers()).toBe(0);
    })
  );
  it.effect(
    "waits for a socket that returns, such as after a session refresh",
    () =>
      Effect.gen(function* () {
        const convex = client(DROPPED);
        const fiber = yield* Effect.forkChild(requireConvexOnline(convex));
        yield* TestClock.adjust("4 seconds");
        expect(convex.subscribers()).toBe(1);

        convex.change(CONNECTED);
        yield* Fiber.join(fiber);

        expect(convex.subscribers()).toBe(0);
      })
  );

  it.effect("keeps waiting through a change that leaves the socket down", () =>
    Effect.gen(function* () {
      const convex = client(DROPPED);
      const fiber = yield* Effect.forkChild(requireConvexOnline(convex));
      yield* TestClock.adjust("1 second");

      convex.change({ ...DROPPED, connectionRetries: 1 });
      yield* TestClock.adjust("1 second");
      expect(fiber.pollUnsafe()).toBeUndefined();
      expect(convex.subscribers()).toBe(1);

      convex.change(CONNECTED);
      yield* Fiber.join(fiber);

      expect(convex.subscribers()).toBe(0);
    })
  );

  it.effect("refuses a call when the socket stays down for five seconds", () =>
    Effect.gen(function* () {
      const convex = client(DROPPED);
      const fiber = yield* Effect.forkChild(
        Effect.flip(requireConvexOnline(convex))
      );
      yield* TestClock.adjust("4999 millis");
      expect(fiber.pollUnsafe()).toBeUndefined();

      yield* TestClock.adjust("1 millis");
      const error = yield* Fiber.join(fiber);

      expect(error).toBeInstanceOf(ConvexOfflineError);
      expect(convex.subscribers()).toBe(0);
    })
  );

  it.effect.each([
    { name: "a connected socket", state: CONNECTED },
    { name: "a dropped socket", state: DROPPED },
  ])(
    "refuses at once when the browser reports no network, with $name",
    ({ state }) =>
      Effect.gen(function* () {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        const convex = client(state);

        const error = yield* Effect.flip(requireConvexOnline(convex));

        expect(error).toBeInstanceOf(ConvexOfflineError);
        expect(convex.subscribers()).toBe(0);
      })
  );
});
