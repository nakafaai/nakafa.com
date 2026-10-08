import type { AnalyticsConsentState } from "@repo/analytics/consent";
import type { RecordContentViewArgs } from "@repo/backend/confect/contents/views/spec";
import { Clock, Effect, Option, Schema } from "effect";
import { nanoid } from "nanoid";

/** Browser storage key of the identifier that counts one consented device. */
const contentViewDeviceKey = "nakafa-device-id";

/** Keeps the JSON string encoding of earlier releases, so devices keep their identifier. */
const ContentViewDeviceSchema = Schema.fromJsonString(Schema.NonEmptyString);
const decodeContentViewDevice = Schema.decodeUnknownOption(
  ContentViewDeviceSchema
);
const encodeContentViewDevice = Schema.encodeEffect(ContentViewDeviceSchema);

/** The browser storage methods this module calls, so callers can supply another store. */
type ContentViewDeviceStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

const contentViewDeviceStorageFailedCode = "CONTENT_VIEW_DEVICE_STORAGE_FAILED";

/** Raised when the browser cannot read, keep, or remove the identifier. */
export class ContentViewDeviceStorageFailed extends Schema.TaggedError<ContentViewDeviceStorageFailed>()(
  "ContentViewDeviceStorageFailed",
  { code: Schema.Literal(contentViewDeviceStorageFailedCode) }
) {}

const contentViewDeviceStorageFailure = () =>
  new ContentViewDeviceStorageFailed({
    code: contentViewDeviceStorageFailedCode,
  });

/**
 * Who one content view may count for under the current analytics consent.
 *
 * Only a granted browser carries a device identifier. Without a grant, a
 * signed-in view still counts for the account's recently viewed content, and
 * a signed-out view records and stores nothing.
 */
export type ContentViewAttribution =
  | "account"
  | "accountDevice"
  | "device"
  | "none"
  | "pending";

/** The identity fields one recorded content view carries. */
type ContentViewIdentity = Pick<RecordContentViewArgs, "deviceId">;

/** Resolves who one content view may count for under analytics consent. */
export function resolveContentViewAttribution({
  isAuthenticated,
  status,
}: {
  readonly isAuthenticated: boolean;
  readonly status: AnalyticsConsentState["status"];
}): ContentViewAttribution {
  if (status === "pending") {
    return "pending";
  }
  if (status === "granted") {
    return isAuthenticated ? "accountDevice" : "device";
  }
  return isAuthenticated ? "account" : "none";
}

/** Returns whether the identifier may stay stored for one durable consent state. */
export function isContentViewDeviceRetained(
  status: AnalyticsConsentState["status"]
) {
  return status === "granted" || status === "pending";
}

const getContentViewDeviceStorage = Effect.fn(
  "www.content.getContentViewDeviceStorage"
)(function* (storage?: ContentViewDeviceStorage) {
  if (storage) {
    return storage;
  }

  return yield* Effect.try({
    try: () => window.localStorage,
    catch: contentViewDeviceStorageFailure,
  });
});

/**
 * Returns this browser's content-view identifier, creating it on first use.
 *
 * Callers run it only for a view that analytics consent lets count per device.
 */
export const ensureContentViewDevice = Effect.fn(
  "www.content.ensureContentViewDevice"
)(function* (storage?: ContentViewDeviceStorage) {
  const target = yield* getContentViewDeviceStorage(storage);
  const persisted = yield* Effect.try({
    try: () => target.getItem(contentViewDeviceKey),
    catch: contentViewDeviceStorageFailure,
  });
  const existing = decodeContentViewDevice(persisted);
  if (Option.isSome(existing)) {
    return existing.value;
  }

  const createdAt = yield* Clock.currentTimeMillis;
  const deviceId = `${createdAt}-${nanoid(9)}`;
  const encoded = yield* encodeContentViewDevice(deviceId).pipe(
    Effect.mapError(contentViewDeviceStorageFailure)
  );
  yield* Effect.try({
    try: () => target.setItem(contentViewDeviceKey, encoded),
    catch: contentViewDeviceStorageFailure,
  });
  return deviceId;
});

/**
 * Reads the identity one engaged content view is recorded with.
 *
 * None means the view is not recorded. A view that consent lets count per
 * device carries this browser's identifier; when storage is blocked, a
 * signed-in view counts for the account alone and a signed-out view is not
 * recorded.
 */
export const readContentViewIdentity = Effect.fn(
  "www.content.readContentViewIdentity"
)(function* (
  attribution: ContentViewAttribution,
  storage?: ContentViewDeviceStorage
) {
  if (attribution === "pending" || attribution === "none") {
    return Option.none<ContentViewIdentity>();
  }
  if (attribution === "account") {
    return Option.some<ContentViewIdentity>({});
  }
  const deviceId = yield* ensureContentViewDevice(storage).pipe(
    Effect.asSome,
    Effect.catchTag("ContentViewDeviceStorageFailed", () => Effect.succeedNone)
  );
  if (Option.isSome(deviceId)) {
    return Option.some<ContentViewIdentity>({ deviceId: deviceId.value });
  }
  if (attribution === "accountDevice") {
    return Option.some<ContentViewIdentity>({});
  }
  return Option.none<ContentViewIdentity>();
});

/** Removes the identifier, so it exists only while analytics consent is granted. */
export const clearContentViewDevice = Effect.fn(
  "www.content.clearContentViewDevice"
)(function* (storage?: ContentViewDeviceStorage) {
  const target = yield* getContentViewDeviceStorage(storage);
  yield* Effect.try({
    try: () => target.removeItem(contentViewDeviceKey),
    catch: contentViewDeviceStorageFailure,
  });
});
