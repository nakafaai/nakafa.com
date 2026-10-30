import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readPushState, subscribeDevice } from "@/lib/notifications/device";

const KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

/** A service worker registration whose push manager holds `subscription`. */
const registrationOf = (subscription: unknown) => ({
  pushManager: {
    getSubscription: vi.fn(() => Promise.resolve(subscription)),
    subscribe: vi.fn(() => Promise.resolve(subscription)),
  },
});

/** Gives the browser the push APIs: a service worker container, the push manager, and notifications. */
const givePush = (
  permission: NotificationPermission,
  registration: ReturnType<typeof registrationOf> | undefined
) => {
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn(() => Promise.resolve(permission)),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn(() => Promise.resolve(registration)),
      register: vi.fn(() =>
        registration === undefined
          ? Promise.reject(new Error("no worker"))
          : Promise.resolve(registration)
      ),
    },
  });
};

/** Makes this browser an iPhone tab, or a desktop, outside or inside the Home Screen. */
const asDevice = (userAgent: string, standalone: boolean, touch = 0) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: touch,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: standalone }))
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

describe("browser push", () => {
  it.effect(
    "tells a browser without push, an iPhone or iPad tab, a blocked one, and one with push off or on",
    () =>
      Effect.gen(function* () {
        expect(yield* readPushState(undefined)).toBe("unsupported");
        asDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", false);
        expect(yield* readPushState(KEY)).toBe("homeScreen");
        asDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", false, 5);
        expect(yield* readPushState(KEY)).toBe("homeScreen");
        asDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)", false);
        expect(yield* readPushState(KEY)).toBe("unsupported");
        givePush("denied", undefined);
        expect(yield* readPushState(KEY)).toBe("blocked");
        givePush("default", undefined);
        expect(yield* readPushState(KEY)).toBe("off");
        givePush("granted", registrationOf(null));
        expect(yield* readPushState(KEY)).toBe("off");
        givePush("granted", registrationOf({ endpoint: "x" }));
        expect(yield* readPushState(KEY)).toBe("on");
      })
  );

  it.effect(
    "subscribes after the person grants the permission, and answers the keys the server stores",
    () =>
      Effect.gen(function* () {
        givePush(
          "granted",
          registrationOf({
            endpoint: "https://push.example.test/abc",
            toJSON: () => ({ keys: { auth: "YXV0aA", p256dh: "a2V5" } }),
          })
        );
        expect(yield* subscribeDevice(KEY)).toEqual({
          auth: "YXV0aA",
          endpoint: "https://push.example.test/abc",
          p256dh: "a2V5",
        });
        givePush(
          "granted",
          registrationOf({
            endpoint: "https://push.example.test/bare",
            toJSON: () => ({}),
          })
        );
        expect(yield* subscribeDevice(KEY)).toEqual({
          auth: "",
          endpoint: "https://push.example.test/bare",
          p256dh: "",
        });
      })
  );

  it.effect(
    "fails at the step that failed: a refused permission, a worker that does not register, a bad key or a refused subscription",
    () =>
      Effect.gen(function* () {
        givePush("denied", registrationOf(null));
        expect(yield* subscribeDevice(KEY).pipe(Effect.flip)).toMatchObject({
          step: "permission",
        });
        givePush("granted", undefined);
        expect(yield* subscribeDevice(KEY).pipe(Effect.flip)).toMatchObject({
          step: "worker",
        });
        givePush("granted", registrationOf(null));
        expect(
          yield* subscribeDevice("not a key!").pipe(Effect.flip)
        ).toMatchObject({ step: "subscribe" });
        const refusing = registrationOf(null);
        refusing.pushManager.subscribe.mockImplementation(() =>
          Promise.reject(new Error("refused"))
        );
        givePush("granted", refusing);
        expect(yield* subscribeDevice(KEY).pipe(Effect.flip)).toMatchObject({
          step: "subscribe",
        });
      })
  );
});
