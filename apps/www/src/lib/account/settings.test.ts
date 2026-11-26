import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import billing from "@repo/backend/confect/_generated/refs/billing";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Array as Arr, Effect, Option } from "effect";
import {
  readConnectorsScreen,
  readLearningScreen,
  readMemoryScreen,
  readSettingsScreen,
  readSubscriptionsScreen,
} from "@/lib/account/settings";

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
  resolveAccountClient: vi.fn<() => Effect.Effect<Option.Option<unknown>>>(),
}));

vi.mock("@/lib/account/client", () => ({
  readAccountOptional: mocks.readAccountOptional,
  readAccountRequired: mocks.readAccountRequired,
  resolveAccountClient: mocks.resolveAccountClient,
}));

vi.mock("@/lib/i18n/rendered", () => ({
  readRenderedRouteMessages: mocks.readRenderedRouteMessages,
}));

const liveClient = { query: vi.fn() };
const ACCOUNT = { appUser: { _id: "u1", name: "Nabil", username: "nabil" } };

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveAccountClient.mockReturnValue(Effect.succeedSome(liveClient));
  mocks.readRenderedRouteMessages.mockResolvedValue({
    Auth: {
      "connectors-description": "Connect Google",
      "learning-description": "Learning settings",
      "memory-description": "Memory settings",
      section: {
        connectors: "Connectors",
        learning: "Learning",
        memory: "Memory",
      },
      "settings-description": "Account settings",
      subscriptions: "Subscriptions",
      "subscriptions-description": "Get {credits} credits",
    },
    Common: { settings: "Settings" },
  });
});

describe("settings browser readers", () => {
  it.effect("returns SignedOut for every screen when no session exists", () =>
    Effect.gen(function* () {
      mocks.resolveAccountClient.mockReturnValue(Effect.succeedNone);
      expect(yield* readSettingsScreen("en")).toEqual({
        _tag: "SignedOut",
      });
      expect(yield* readLearningScreen("en")).toEqual({
        _tag: "SignedOut",
      });
      expect(yield* readMemoryScreen("en")).toEqual({
        _tag: "SignedOut",
      });
      expect(yield* readConnectorsScreen("en")).toEqual({
        _tag: "SignedOut",
      });
      expect(yield* readSubscriptionsScreen("en")).toEqual({
        _tag: "SignedOut",
      });
    })
  );

  it.effect("reads Account settings and maps missing account or refusal", () =>
    Effect.gen(function* () {
      answerRequired([[auth.queries.getCurrentUser, ACCOUNT]]);
      const ready = yield* readSettingsScreen("en");
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: { account: ACCOUNT, seo: { title: "Settings" } },
      });

      answerRequired([[auth.queries.getCurrentUser, null]]);
      expect(yield* readSettingsScreen("en")).toEqual({
        _tag: "NotFound",
      });

      mocks.readAccountRequired.mockReturnValueOnce(
        Effect.succeed({ _tag: "SignedOut" })
      );
      expect(yield* readSettingsScreen("en")).toEqual({
        _tag: "SignedOut",
      });
    })
  );

  it.effect(
    "reads Learning settings and handles missing account or refusal",
    () =>
      Effect.gen(function* () {
        answerRequired([
          [auth.queries.getCurrentUser, ACCOUNT],
          [learningPreferences.queries.listCurriculumPrograms, ["merdeka"]],
        ]);
        mocks.readAccountOptional.mockReturnValue(
          Effect.succeed({ program: "merdeka" })
        );
        const ready = yield* readLearningScreen("en");
        expect(ready).toMatchObject({
          _tag: "Ready",
          screen: {
            account: ACCOUNT,
            preference: { program: "merdeka" },
            programs: ["merdeka"],
          },
        });

        answerRequired([
          [auth.queries.getCurrentUser, null],
          [learningPreferences.queries.listCurriculumPrograms, []],
        ]);
        expect(yield* readLearningScreen("en")).toEqual({
          _tag: "NotFound",
        });

        mocks.readAccountRequired.mockImplementation((_client, ref) =>
          Effect.succeed(
            ref === auth.queries.getCurrentUser
              ? { _tag: "SignedOut" }
              : { _tag: "Value", value: [] }
          )
        );
        expect(yield* readLearningScreen("en")).toEqual({
          _tag: "SignedOut",
        });

        mocks.readAccountRequired.mockImplementation((_client, ref) =>
          Effect.succeed(
            ref === learningPreferences.queries.listCurriculumPrograms
              ? { _tag: "NotFound" }
              : { _tag: "Value", value: ACCOUNT }
          )
        );
        expect(yield* readLearningScreen("en")).toEqual({
          _tag: "NotFound",
        });
      })
  );

  it.effect("reads Memory settings and handles missing state or refusal", () =>
    Effect.gen(function* () {
      answerRequired([
        [nina.memory.list, { page: ["m1"] }],
        [nina.memory.state, { paused: true }],
      ]);
      const ready = yield* readMemoryScreen("en");
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: { first: { page: ["m1"] }, paused: true },
      });

      answerRequired([
        [nina.memory.list, { page: [] }],
        [nina.memory.state, null],
      ]);
      expect(yield* readMemoryScreen("en")).toEqual({
        _tag: "NotFound",
      });

      mocks.readAccountRequired.mockImplementation((_client, ref) =>
        Effect.succeed(
          ref === nina.memory.list
            ? { _tag: "SignedOut" }
            : { _tag: "Value", value: { paused: false } }
        )
      );
      expect(yield* readMemoryScreen("en")).toEqual({
        _tag: "SignedOut",
      });

      mocks.readAccountRequired.mockImplementation((_client, ref) =>
        Effect.succeed(
          ref === nina.memory.state
            ? { _tag: "NotFound" }
            : { _tag: "Value", value: { page: [] } }
        )
      );
      expect(yield* readMemoryScreen("en")).toEqual({
        _tag: "NotFound",
      });
    })
  );

  it.effect("reads Connectors settings and handles refusals", () =>
    Effect.gen(function* () {
      answerRequired([
        [connectors.connections.listOwn, { page: [] }],
        [connectors.google.offered, ["drive"]],
      ]);
      const ready = yield* readConnectorsScreen("en");
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: { first: { page: [] }, offered: ["drive"] },
      });

      mocks.readAccountRequired.mockImplementation((_client, ref) =>
        Effect.succeed(
          ref === connectors.connections.listOwn
            ? { _tag: "SignedOut" }
            : { _tag: "Value", value: [] }
        )
      );
      expect(yield* readConnectorsScreen("en")).toEqual({
        _tag: "SignedOut",
      });

      mocks.readAccountRequired.mockImplementation((_client, ref) =>
        Effect.succeed(
          ref === connectors.google.offered
            ? { _tag: "NotFound" }
            : { _tag: "Value", value: { page: [] } }
        )
      );
      expect(yield* readConnectorsScreen("en")).toEqual({
        _tag: "NotFound",
      });
    })
  );

  it.effect("reads Subscriptions settings and handles refusal", () =>
    Effect.gen(function* () {
      answerRequired([[billing.queries.overview, { plan: "pro" }]]);
      const ready = yield* readSubscriptionsScreen("en");
      expect(ready).toMatchObject({
        _tag: "Ready",
        screen: { overview: { plan: "pro" }, seo: { title: "Subscriptions" } },
      });

      mocks.readAccountRequired.mockReturnValueOnce(
        Effect.succeed({ _tag: "SignedOut" })
      );
      expect(yield* readSubscriptionsScreen("en")).toEqual({
        _tag: "SignedOut",
      });
    })
  );
});
