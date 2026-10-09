import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  ConvexOfflineError,
  isConvexOffline,
  requireConvexOnline,
} from "@/lib/convex/online";

type ConnectionState = Parameters<typeof isConvexOffline>[0];

/** Builds a connection state whose fields the rule does not read are at rest. */
function connection(
  state: Pick<
    ConnectionState,
    "connectionCount" | "connectionRetries" | "isWebSocketConnected"
  >
): ConnectionState {
  return {
    ...state,
    hasEverConnected: state.connectionCount > 0,
    hasInflightRequests: false,
    inflightActions: 0,
    inflightMutations: 0,
    timeOfOldestInflightRequest: null,
  };
}

/** Builds the part of the Convex client the guard reads at the moment of a call. */
function client(state: Parameters<typeof connection>[0]) {
  return { connectionState: () => connection(state) };
}

describe("Convex online state", () => {
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
      name: "connected after an earlier connection",
      state: {
        connectionCount: 2,
        connectionRetries: 0,
        isWebSocketConnected: true,
      },
      offline: false,
    },
    {
      name: "not connected after an earlier connection",
      state: {
        connectionCount: 2,
        connectionRetries: 0,
        isWebSocketConnected: false,
      },
      offline: true,
    },
    {
      name: "not connected after failed attempts only",
      state: {
        connectionCount: 0,
        connectionRetries: 3,
        isWebSocketConnected: false,
      },
      offline: true,
    },
  ])("is offline when $name: $offline", ({ state, offline }) => {
    expect(isConvexOffline(connection(state))).toBe(offline);
  });

  it.effect("fails with ConvexOfflineError while the socket is down", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        requireConvexOnline(
          client({
            connectionCount: 2,
            connectionRetries: 0,
            isWebSocketConnected: false,
          })
        )
      );

      expect(error).toBeInstanceOf(ConvexOfflineError);
    })
  );

  it.effect("succeeds before the first attempt", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        requireConvexOnline(
          client({
            connectionCount: 0,
            connectionRetries: 0,
            isWebSocketConnected: false,
          })
        )
      );

      expect(Result.isSuccess(result)).toBe(true);
    })
  );

  it.effect("succeeds while the socket is connected", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        requireConvexOnline(
          client({
            connectionCount: 2,
            connectionRetries: 0,
            isWebSocketConnected: true,
          })
        )
      );

      expect(Result.isSuccess(result)).toBe(true);
    })
  );
});
