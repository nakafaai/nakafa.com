import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import progress from "@repo/backend/confect/_generated/refs/progress";
import users from "@repo/backend/confect/_generated/refs/users";
import { Array as Arr, Effect, Option } from "effect";
import {
  readProfileBadgesScreen,
  readProfileChatScreen,
  readProfileCommentsScreen,
  readProfilePostsScreen,
  readProfileScreen,
} from "@/lib/account/profile";

const mocks = vi.hoisted(() => ({
  readAccountOptional:
    vi.fn<
      (
        client: unknown,
        ref: unknown,
        args: unknown,
        source: string
      ) => Effect.Effect<unknown>
    >(),
  readAccountRequired:
    vi.fn<
      (
        client: unknown,
        ref: unknown,
        args: unknown
      ) => Effect.Effect<
        | { readonly _tag: "NotFound" }
        | { readonly _tag: "SignedOut" }
        | { readonly _tag: "Value"; readonly value: unknown }
      >
    >(),
  readRenderedRouteMessages: vi.fn(),
  resolveBrowserClient:
    vi.fn<() => Effect.Effect<{ client: unknown; signedIn: boolean }>>(),
}));

vi.mock("@/lib/account/client", () => ({
  readAccountOptional: mocks.readAccountOptional,
  readAccountRequired: mocks.readAccountRequired,
  resolveBrowserClient: mocks.resolveBrowserClient,
}));

vi.mock("@/lib/i18n/rendered", () => ({
  readRenderedRouteMessages: mocks.readRenderedRouteMessages,
}));

const liveClient = { query: vi.fn() };
const PROFILE = { _id: "u1", name: "Nabil", username: "nabil" };

function answerRequired(answers: ReadonlyArray<readonly [unknown, unknown]>) {
  mocks.readAccountRequired.mockImplementation((_client, ref) =>
    Option.match(
      Arr.findFirst(answers, ([query]) => query === ref),
      {
        onNone: () => Effect.die("unexpected required query"),
        onSome: ([, value]) =>
          Effect.succeed({ _tag: "Value" as const, value }),
      }
    )
  );
}

/** Resolves a typed `ProfileIdentity` through `readProfileScreen` as the parent layout does. */
const loadKnown = (isOwner: boolean) =>
  Effect.gen(function* () {
    mocks.resolveBrowserClient.mockReturnValueOnce(
      Effect.succeed({ client: liveClient, signedIn: isOwner })
    );
    answerRequired([[users.queries.getProfileByUsername, PROFILE]]);
    if (isOwner) {
      mocks.readAccountOptional.mockReturnValueOnce(
        Effect.succeed({ appUser: { _id: "u1" } })
      );
    }
    const outcome = yield* readProfileScreen("Nabil", "c");
    if (outcome._tag !== "Ready") {
      return expect.unreachable("expected Ready");
    }
    vi.clearAllMocks();
    mocks.resolveBrowserClient.mockReturnValue(
      Effect.succeed({ client: liveClient, signedIn: true })
    );
    mocks.readRenderedRouteMessages.mockResolvedValue({
      Auth: {
        "chat-description": "Profile chats",
        profile: "Profile",
        "profile-description": "Profile description",
      },
      Common: { chat: "Chat" },
    });
    return outcome.screen;
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveBrowserClient.mockReturnValue(
    Effect.succeed({ client: liveClient, signedIn: true })
  );
  mocks.readRenderedRouteMessages.mockResolvedValue({
    Auth: {
      "chat-description": "Profile chats",
      profile: "Profile",
      "profile-description": "Profile description",
    },
    Common: { chat: "Chat" },
  });
});

describe("profile browser readers", () => {
  it.effect("reads profile screen for owner, visitor, and missing user", () =>
    Effect.gen(function* () {
      answerRequired([[users.queries.getProfileByUsername, PROFILE]]);
      mocks.readAccountOptional.mockReturnValue(
        Effect.succeed({ appUser: { _id: "u1" } })
      );
      expect(yield* readProfileScreen("Nabil", "c")).toEqual({
        _tag: "Ready",
        screen: { isOwner: true, profile: PROFILE },
      });

      mocks.resolveBrowserClient.mockReturnValue(
        Effect.succeed({ client: liveClient, signedIn: false })
      );
      expect(yield* readProfileScreen("nabil", "")).toEqual({
        _tag: "Ready",
        screen: { isOwner: false, profile: PROFILE },
      });

      answerRequired([[users.queries.getProfileByUsername, null]]);
      expect(yield* readProfileScreen("nobody", "")).toEqual({
        _tag: "NotFound",
      });
    })
  );

  it.effect(
    "reads Posts tab reusing known identity or looking up missing user",
    () =>
      Effect.gen(function* () {
        const known = yield* loadKnown(true);
        mocks.readAccountOptional.mockReturnValue(
          Effect.succeed({ page: ["p1"] })
        );
        const ready = yield* readProfilePostsScreen("en", "Nabil", "c", known);
        expect(ready).toMatchObject({
          _tag: "Ready",
          screen: {
            first: { page: ["p1"] },
            seo: { canonicalPath: "/en/@nabil" },
          },
        });
        expect(mocks.readAccountRequired).not.toHaveBeenCalled();

        answerRequired([[users.queries.getProfileByUsername, null]]);
        expect(yield* readProfilePostsScreen("en", "nobody", "c")).toEqual({
          _tag: "NotFound",
        });
      })
  );

  it.effect("reads Comments tab and maps missing user or author refusal", () =>
    Effect.gen(function* () {
      const known = yield* loadKnown(true);
      answerRequired([[auth.queries.getUserById, { name: "Nabil" }]]);
      mocks.readAccountOptional.mockReturnValue(
        Effect.succeed({ page: ["c1"] })
      );
      const ready = yield* readProfileCommentsScreen("en", "Nabil", "c", known);
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: {
          author: { name: "Nabil" },
          first: { page: ["c1"] },
          seo: { canonicalPath: "/en/@nabil/comments" },
          userId: "u1",
        },
      });

      mocks.readAccountRequired.mockReturnValueOnce(
        Effect.succeed({ _tag: "NotFound" })
      );
      expect(
        yield* readProfileCommentsScreen("en", "nabil", "c", known)
      ).toEqual({ _tag: "NotFound" });

      answerRequired([[users.queries.getProfileByUsername, null]]);
      expect(yield* readProfileCommentsScreen("en", "nobody", "c")).toEqual({
        _tag: "NotFound",
      });
    })
  );

  it.effect("reads Badges tab and maps missing user or null medals", () =>
    Effect.gen(function* () {
      const known = yield* loadKnown(true);
      answerRequired([[progress.queries.medals, { level: 3 }]]);
      const ready = yield* readProfileBadgesScreen("en", "Nabil", "c", known);
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: {
          medals: { level: 3 },
          seo: { canonicalPath: "/en/@nabil/badges" },
        },
      });

      answerRequired([[progress.queries.medals, null]]);
      expect(yield* readProfileBadgesScreen("en", "nabil", "c", known)).toEqual(
        { _tag: "NotFound" }
      );

      answerRequired([[users.queries.getProfileByUsername, null]]);
      expect(yield* readProfileBadgesScreen("en", "nobody", "c")).toEqual({
        _tag: "NotFound",
      });
    })
  );

  it.effect("reads Chat tab for owner and returns NotFound for non-owner", () =>
    Effect.gen(function* () {
      const ownerKnown = yield* loadKnown(true);
      const visitorKnown = yield* loadKnown(false);
      mocks.readAccountOptional.mockReturnValue(
        Effect.succeed({ page: ["ch1"] })
      );
      const ready = yield* readProfileChatScreen(
        "en",
        "Nabil",
        "c",
        ownerKnown
      );
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: {
          first: { page: ["ch1"] },
          seo: { canonicalPath: "/en/@nabil/chat", title: "Chat" },
        },
      });
      expect(mocks.readAccountOptional).toHaveBeenCalledWith(
        liveClient,
        chats.queries.getOwnChats,
        expect.objectContaining({ type: "study" }),
        "profile.chat"
      );

      expect(
        yield* readProfileChatScreen("en", "nabil", "c", visitorKnown)
      ).toEqual({ _tag: "NotFound" });

      answerRequired([[users.queries.getProfileByUsername, null]]);
      expect(yield* readProfileChatScreen("en", "nobody", "c")).toEqual({
        _tag: "NotFound",
      });
    })
  );
});
