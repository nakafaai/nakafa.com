import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentAccountMarker,
  type AnonymousAnalyticsConsentRecord,
  decodeAnonymousAnalyticsConsent,
  encodeAnalyticsConsentAccountMarker,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect, Option, Schema } from "effect";

type AnalyticsConsentStorage = Pick<Storage, "getItem" | "setItem">;

const analyticsConsentStorageFailedCode = "ANALYTICS_CONSENT_STORAGE_FAILED";

/** Raised when the browser cannot retain an analytics privacy choice. */
export class AnalyticsConsentStorageFailed extends Schema.TaggedError<AnalyticsConsentStorageFailed>()(
  "AnalyticsConsentStorageFailed",
  { code: Schema.Literal(analyticsConsentStorageFailedCode) }
) {}

const analyticsConsentStorageFailure = () =>
  new AnalyticsConsentStorageFailed({
    code: analyticsConsentStorageFailedCode,
  });

const getAnalyticsConsentStorage = Effect.fn(
  "www.analytics.getAnalyticsConsentStorage"
)(function* (storage?: AnalyticsConsentStorage) {
  if (storage) {
    return storage;
  }

  return yield* Effect.try({
    try: () => window.localStorage,
    catch: analyticsConsentStorageFailure,
  });
});

/** Reads the anonymous browser decision without accepting malformed state. */
export const loadAnonymousAnalyticsConsent = Effect.fn(
  "www.analytics.loadAnonymousAnalyticsConsent"
)(function* (storage?: AnalyticsConsentStorage) {
  const target = yield* getAnalyticsConsentStorage(storage);
  const persisted = yield* Effect.try({
    try: () => target.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY),
    catch: analyticsConsentStorageFailure,
  });

  if (persisted === null) {
    return Option.none<AnonymousAnalyticsConsentRecord>();
  }

  return decodeAnonymousAnalyticsConsent(persisted);
});

/**
 * Records the signed-in account's confirmed choice and its session in this
 * browser, so the next page decides before paint for that session only.
 */
export const saveAnalyticsConsentAccountMarker = Effect.fn(
  "www.analytics.saveAnalyticsConsentAccountMarker"
)(function* (
  marker: AnalyticsConsentAccountMarker,
  storage?: AnalyticsConsentStorage
) {
  const target = yield* getAnalyticsConsentStorage(storage);
  const encoded = yield* encodeAnalyticsConsentAccountMarker(marker).pipe(
    Effect.mapError(analyticsConsentStorageFailure)
  );

  yield* Effect.try({
    try: () => target.setItem(ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY, encoded),
    catch: analyticsConsentStorageFailure,
  });
});

/** Persists one explicit anonymous browser decision under the current notice. */
export const saveAnonymousAnalyticsConsent = Effect.fn(
  "www.analytics.saveAnonymousAnalyticsConsent"
)(function* (
  consent: AnonymousAnalyticsConsentRecord,
  storage?: AnalyticsConsentStorage
) {
  const target = yield* getAnalyticsConsentStorage(storage);
  const encoded = yield* encodeAnonymousAnalyticsConsent(consent).pipe(
    Effect.mapError(analyticsConsentStorageFailure)
  );

  yield* Effect.try({
    try: () => target.setItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, encoded),
    catch: analyticsConsentStorageFailure,
  });
});
