import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { followClientSession } from "@/lib/auth/feed";
import type { AuthSession } from "@/lib/auth/session";
import { sessionUser } from "@/lib/auth/user";

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** An access token of `session-1`. */
const TOKEN = Arr.join(
  [
    Base64Url.encode(encodeJson({ alg: "ES256" })),
    Base64Url.encode(encodeJson({ exp: 4_102_444_800, sub: "session-1" })),
    "signature",
  ],
  "."
);

/** What Convex Auth's client shows of its session. */
interface Snapshot {
  readonly isLoading: boolean;
  readonly token: string | null;
}

/** Convex Auth's client as the feed reads it: its snapshot, its listeners and its refresh. */
const auth = vi.hoisted(() => {
  const snapshot: Snapshot = { isLoading: false, token: null };
  return {
    fetchAccessToken: vi.fn<() => Promise<string | null>>(),
    listeners: new Set<() => void>(),
    snapshot,
  };
});

vi.mock("@/lib/auth/client", () => ({
  readAuthClient: () =>
    Effect.succeed({
      fetchAccessToken: auth.fetchAccessToken,
      getAccessToken: () => auth.snapshot.token,
      getSnapshot: () => auth.snapshot,
      subscribe: (listener: () => void) => {
        auth.listeners.add(listener);
        return () => auth.listeners.delete(listener);
      },
    }),
}));

/** The page's Convex client, which the mocked auth client never reads. */
const convex = {
  mutation: vi.fn(),
  url: "https://example.convex.cloud",
};

/** Lets the feed's fiber and the refresh it awaits run. */
const settle = Effect.sleep("20 millis");

/** Follows the feed and collects what it reports. */
function follow() {
  const seen: AuthSession[] = [];
  const unsubscribe = followClientSession(convex).subscribe((session) => {
    seen.push(session);
  });
  return { seen, unsubscribe };
}

beforeEach(() => {
  auth.fetchAccessToken.mockReset();
  auth.listeners.clear();
  auth.snapshot = { isLoading: false, token: null };
  sessionUser.setState({ user: null });
});

describe("followClientSession", () => {
  it.live("reports a held session with the account its answer named", () =>
    Effect.gen(function* () {
      auth.snapshot = { isLoading: false, token: TOKEN };
      sessionUser.setState({
        user: { sessionId: "session-1", userId: "user-1" },
      });

      const { seen, unsubscribe } = follow();
      yield* settle;

      expect(seen.at(-1)).toEqual({
        hasError: false,
        isPending: false,
        sessionId: "session-1",
        userId: "user-1",
      });
      expect(auth.fetchAccessToken).not.toHaveBeenCalled();

      sessionUser.setState({ user: { sessionId: "other", userId: "user-2" } });
      expect(seen.at(-1)?.userId).toBeNull();

      unsubscribe();
      yield* settle;
      expect(auth.listeners.size).toBe(0);
    })
  );

  it.live("reads as pending until the first refresh answers", () =>
    Effect.gen(function* () {
      auth.fetchAccessToken.mockImplementation(() => {
        auth.snapshot = { isLoading: false, token: TOKEN };
        return Promise.resolve(TOKEN);
      });

      const { seen, unsubscribe } = follow();
      yield* settle;

      expect(seen[0]?.isPending).toBe(true);
      expect(seen.at(-1)).toMatchObject({
        hasError: false,
        isPending: false,
        sessionId: "session-1",
      });
      expect(auth.fetchAccessToken).toHaveBeenCalledWith({
        forceRefreshToken: true,
      });
      unsubscribe();
    })
  );

  it.live(
    "reports a failed first refresh as a failed read, not a visitor",
    () =>
      Effect.gen(function* () {
        auth.fetchAccessToken.mockRejectedValue(new Error("offline"));

        const { seen, unsubscribe } = follow();
        yield* settle;

        expect(seen.at(-1)).toMatchObject({
          hasError: true,
          isPending: false,
        });
        unsubscribe();
      })
  );
});
