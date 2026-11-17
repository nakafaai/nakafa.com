import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, MutableHashSet, MutableList, MutableRef } from "effect";
import { followGoogleFailure } from "@/lib/auth/flow";

/** Convex Auth's oauth values as the follower reads them: the flow error, its listeners, and the scopes asked for. The mocked client reads them only once a test runs. */
const oauth = {
  flowError: MutableRef.make<unknown>(null),
  listeners: MutableHashSet.empty<() => void>(),
  scopes: MutableList.make<string>(),
};

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () =>
    Effect.succeed({
      ambientSignInValues: (scope: string) => {
        MutableList.append(oauth.scopes, scope);
        return {
          get: () => MutableRef.get(oauth.flowError),
          subscribe: (key: string, listener: () => void) => {
            expect(key).toBe("flowError");
            MutableHashSet.add(oauth.listeners, listener);
            return () => MutableHashSet.remove(oauth.listeners, listener);
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
  MutableRef.set(oauth.flowError, flowError);
  for (const listener of oauth.listeners) {
    listener();
  }
};

beforeEach(() => {
  MutableRef.set(oauth.flowError, null);
  MutableHashSet.clear(oauth.listeners);
  MutableList.clear(oauth.scopes);
});

describe("followGoogleFailure", () => {
  it.live(
    "reports a failed return, its clearing, and stops when unsubscribed",
    () =>
      Effect.gen(function* () {
        const seen = MutableList.make<boolean>();
        const unsubscribe = followGoogleFailure(convex).subscribe((failed) => {
          MutableList.append(seen, failed);
        });
        yield* settle;

        expect(MutableList.toArray(oauth.scopes)).toEqual(["oauth"]);
        expect(MutableList.toArray(seen)).toEqual([false]);

        publish({ error: "ACCESS_DENIED" });
        publish(null);
        expect(MutableList.toArray(seen)).toEqual([false, true, false]);

        unsubscribe();
        yield* settle;
        expect(MutableHashSet.size(oauth.listeners)).toBe(0);
      })
  );

  it.live("reads a flow error that was already there when it started", () =>
    Effect.gen(function* () {
      MutableRef.set(oauth.flowError, { error: "EXPIRED" });
      const seen = MutableList.make<boolean>();
      const unsubscribe = followGoogleFailure(convex).subscribe((failed) => {
        MutableList.append(seen, failed);
      });
      yield* settle;

      expect(MutableList.toArray(seen)).toEqual([true]);
      unsubscribe();
    })
  );
});
