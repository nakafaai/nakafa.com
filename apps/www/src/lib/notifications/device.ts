import { Effect, Schema } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * Where this browser stands with push (ADR 0027): it cannot take push, it is an
 * iPhone or iPad tab that takes push only from the Home Screen, the person
 * blocked notifications, push is off, or it is on.
 */
export const PushState = Schema.Literals([
  "unsupported",
  "homeScreen",
  "blocked",
  "off",
  "on",
]);

/** The address of the service worker that shows a push. */
const WORKER_PATH = "/sw.js";

/** The name an iPhone, iPad or iPod gives itself in its user agent. */
const APPLE_DEVICE = /iPad|iPhone|iPod/u;

/** A step of the browser's push that failed. */
class DevicePushFailed extends Schema.TaggedError<DevicePushFailed>()(
  "DevicePushFailed",
  { step: Schema.Literals(["permission", "worker", "subscribe"]) }
) {}

/**
 * Whether this is an iPhone or iPad tab outside the Home Screen: iOS and iPadOS
 * give push only to a web app opened from its Home Screen icon (WebKit, "Web Push
 * for Web Apps on iOS and iPadOS"). An iPad reports itself as a Mac with a touch
 * screen.
 */
const isAppleTab = () => {
  const apple =
    APPLE_DEVICE.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return apple && !window.matchMedia("(display-mode: standalone)").matches;
};

/** Where this browser stands with push, read from its own APIs. */
export const readPushState = Effect.fn("notifications.device.state")(function* (
  publicKey: string | undefined
) {
  if (publicKey === undefined) {
    return "unsupported" as const;
  }
  if (
    !(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    )
  ) {
    return isAppleTab() ? ("homeScreen" as const) : ("unsupported" as const);
  }
  if (Notification.permission === "denied") {
    return "blocked" as const;
  }
  const registration = yield* Effect.promise(() =>
    navigator.serviceWorker.getRegistration(WORKER_PATH)
  );
  if (registration === undefined) {
    return "off" as const;
  }
  const subscription = yield* Effect.promise(() =>
    registration.pushManager.getSubscription()
  );
  return subscription === null ? ("off" as const) : ("on" as const);
});

/**
 * Turns push on for this browser after the person's tap: asks for permission,
 * registers the service worker, and subscribes with the application server's
 * public key. It answers the subscription as the server stores it.
 */
export const subscribeDevice = Effect.fn("notifications.device.subscribe")(
  function* (publicKey: string) {
    const permission = yield* Effect.promise(() =>
      Notification.requestPermission()
    );
    if (permission !== "granted") {
      return yield* new DevicePushFailed({ step: "permission" });
    }
    const registration = yield* Effect.tryPromise({
      catch: () => new DevicePushFailed({ step: "worker" }),
      try: () => navigator.serviceWorker.register(WORKER_PATH),
    });
    const key = yield* Effect.mapError(
      Effect.fromResult(Base64Url.decode(publicKey)),
      () => new DevicePushFailed({ step: "subscribe" })
    );
    const subscription = yield* Effect.tryPromise({
      catch: () => new DevicePushFailed({ step: "subscribe" }),
      try: () =>
        registration.pushManager.subscribe({
          applicationServerKey: new Uint8Array(key),
          userVisibleOnly: true,
        }),
    });
    const keys = subscription.toJSON().keys ?? {};
    return {
      auth: keys.auth ?? "",
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? "",
    };
  }
);
