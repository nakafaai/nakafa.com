import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { followGoogleFailure } from "@/lib/auth/flow";

/** Convex Auth's oauth values as the follower reads them: the flow error and its listeners. */
const oauth = vi.hoisted(() => ({
  flowError: null as unknown,
  listeners: new Set<() => void>(),
  scopes: [] as string[],
}));

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () =>
    Effect.succeed({
      ambientSignInValues: (scope: string) => {
        oauth.scopes.push(scope);
        return {
          get: () => oauth.flowError,
          subscribe: (key: string, listener: () => void) => {
            expect(key).toBe("flowError");
            oauth.listeners.add(listener);
            return () => oauth.listeners.delete(listener);
          },
        };
      },
    }),
}));

/** The page's Convex client, which the mocked auth client never reads. */
const convex = {
  mutation: vi.fn(),
  url: "https://example.convex.cloud",
};

/** Lets the follower's fiber run. */
const settle = Effect.sleep("20 millis");

/** Publishes a flow error and tells every listener, as Convex Auth's client does. */
const publish = (flowError: unknown) => {
  oauth.flowError = flowError;
  for (const listener of oauth.listeners) {
    listener();
  }
};

beforeEach(() => {
  oauth.flowError = null;
  oauth.listeners.clear();
  oauth.scopes.length = 0;
});

describe("followGoogleFailure", () => {
  it.live(
    "reports a failed return, its clearing, and stops when unsubscribed",
    () =>
      Effect.gen(function* () {
        const seen: boolean[] = [];
        const unsubscribe = followGoogleFailure(convex).subscribe((failed) => {
          seen.push(failed);
        });
        yield* settle;

        expect(oauth.scopes).toEqual(["oauth"]);
        expect(seen).toEqual([false]);

        publish({ error: "ACCESS_DENIED" });
        publish(null);
        expect(seen).toEqual([false, true, false]);

        unsubscribe();
        yield* settle;
        expect(oauth.listeners.size).toBe(0);
      })
  );

  it.live("reads a flow error that was already there when it started", () =>
    Effect.gen(function* () {
      oauth.flowError = { error: "EXPIRED" };
      const seen: boolean[] = [];
      const unsubscribe = followGoogleFailure(convex).subscribe((failed) => {
        seen.push(failed);
      });
      yield* settle;

      expect(seen).toEqual([true]);
      unsubscribe();
    })
  );
});
