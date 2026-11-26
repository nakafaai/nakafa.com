import { beforeEach, describe, expect, it } from "@effect/vitest";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { Option } from "effect";
import { Effect } from "effect";
import { readNotificationsScreen } from "@/lib/account/notifications";

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
  readRenderedRouteMessages: vi.fn(),
  resolveAccountClient: vi.fn<() => Effect.Effect<Option.Option<unknown>>>(),
}));

vi.mock("@/lib/account/client", () => ({
  readAccountOptional: mocks.readAccountOptional,
  resolveAccountClient: mocks.resolveAccountClient,
}));

vi.mock("@/lib/i18n/rendered", () => ({
  readRenderedRouteMessages: mocks.readRenderedRouteMessages,
}));

const liveClient = { query: vi.fn() };
const ORIGIN = "https://nakafa.com";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveAccountClient.mockReturnValue(Effect.succeedSome(liveClient));
  mocks.readRenderedRouteMessages.mockResolvedValue({
    Common: { notifications: "Notifications" },
    Metadata: { description: "Learn with Nakafa" },
  });
});

describe("readNotificationsScreen", () => {
  it.effect("returns SignedOut when no account client can be resolved", () =>
    Effect.gen(function* () {
      mocks.resolveAccountClient.mockReturnValue(Effect.succeedNone);
      expect(yield* readNotificationsScreen("en", ORIGIN)).toEqual({
        _tag: "SignedOut",
      });
      expect(mocks.readAccountOptional).not.toHaveBeenCalled();
    })
  );

  it.effect("reads the inbox page and builds the noindex head", () =>
    Effect.gen(function* () {
      mocks.readAccountOptional.mockReturnValue(
        Effect.succeed({ page: ["note-1"] })
      );
      const outcome = yield* readNotificationsScreen("en", ORIGIN);
      expect(outcome._tag).toBe("Ready");
      if (outcome._tag !== "Ready") {
        return expect.unreachable("expected Ready");
      }
      expect(outcome.screen.first).toEqual({ page: ["note-1"] });
      expect(outcome.screen.seo).toEqual({
        canonicalPath: "/en",
        description: "Learn with Nakafa",
        indexable: false,
        locale: "en",
        title: "Notifications",
      });
      expect(mocks.readAccountOptional).toHaveBeenCalledWith(
        liveClient,
        notifications.inbox.list,
        expect.objectContaining({ personal: true }),
        "notifications.readOptional"
      );
    })
  );
});
