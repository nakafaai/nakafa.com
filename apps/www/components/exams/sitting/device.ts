import { Id } from "@repo/backend/confect/_generated/id";
import { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import { Effect, Option, Schema } from "effect";

/** The browser storage methods this module calls, so a caller can supply another store. */
type SittingDeviceStorage = Readonly<Pick<Storage, "getItem" | "setItem">>;

/** Raised when the browser refuses to read or keep the device of a sitting. */
export class SittingDeviceStorageFailed extends Schema.TaggedError<SittingDeviceStorageFailed>()(
  "SittingDeviceStorageFailed",
  {}
) {}

/** The browser storage key of the device that holds one sitting's attempt. */
function sittingDeviceKey(sittingId: string) {
  return `nakafa-sitting-device:${sittingId}`;
}

/** The store of this browser, or a failure when the browser keeps no local storage. */
const storageOf = Effect.fn("exams.sitting.device.storage")(function* (
  storage?: SittingDeviceStorage
) {
  if (storage) {
    return storage;
  }
  return yield* Effect.try({
    try: () => window.localStorage,
    catch: () => new SittingDeviceStorageFailed(),
  });
});

/** The text this browser keeps for a sitting's device, or none when it keeps no text. */
const readStored = Effect.fn("exams.sitting.device.stored")(function* (
  sittingId: string,
  storage?: SittingDeviceStorage
) {
  const target = yield* storageOf(storage);
  return yield* Effect.try({
    try: () => target.getItem(sittingDeviceKey(sittingId)),
    catch: () => new SittingDeviceStorageFailed(),
  });
});

/**
 * Reads the device that this browser holds for a sitting. None means the browser holds
 * none, or it refuses to read storage, so the student enters with the token.
 */
export const readSittingDevice = Effect.fn("exams.sitting.device.read")(
  function* (sittingId: string, storage?: SittingDeviceStorage) {
    const persisted = yield* readStored(sittingId, storage).pipe(
      Effect.catchTag("SittingDeviceStorageFailed", () => Effect.succeed(null))
    );
    return Option.flatMap(Option.fromNullishOr(persisted), (value) =>
      Schema.decodeOption(DeviceId)(value)
    );
  }
);

/** The device of an entry in flight: the device that the entry sends before the browser keeps one. */
export const SittingFlight = Schema.Struct({
  deviceId: DeviceId,
  sittingId: Id("examSittings"),
});
export type SittingFlight = typeof SittingFlight.Type;

/**
 * The device that one entry reuses: the one the browser keeps for the sitting, else the one that an entry in
 * flight for the same sitting sends, so a second press admits the same attempt. None means the entry needs a
 * new device.
 */
export function reusedDeviceOf(
  stored: Option.Option<typeof DeviceId.Type>,
  flight: SittingFlight | null,
  sittingId: string
): Option.Option<typeof DeviceId.Type> {
  if (Option.isSome(stored)) {
    return stored;
  }
  if (flight !== null && flight.sittingId === sittingId) {
    return Option.some(flight.deviceId);
  }
  return Option.none();
}

/**
 * Keeps the device of a sitting in this browser, so a reload enters without the token. The
 * caller keeps the device for the session when the browser refuses to store it.
 */
export const rememberSittingDevice = Effect.fn("exams.sitting.device.remember")(
  function* (
    sittingId: string,
    deviceId: typeof DeviceId.Type,
    storage?: SittingDeviceStorage
  ) {
    const target = yield* storageOf(storage);
    yield* Effect.try({
      try: () => target.setItem(sittingDeviceKey(sittingId), deviceId),
      catch: () => new SittingDeviceStorageFailed(),
    });
  }
);
