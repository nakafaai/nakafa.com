import { Effect, Option, Schema, String as Str } from "effect";

/**
 * The token a scanned room code carries after the `#` of the sitting's address, in the form the
 * student would type it: without spaces, in upper case. An address without one carries none.
 */
export function scannedToken(hash: string) {
  const token = Str.toUpperCase(Str.replace(/[#\s]/g, "")(hash));
  return Str.isEmpty(token) ? Option.none<string>() : Option.some(token);
}

/** The part of the browser's session storage that a scanned room code waits in. */
type RoomCodeStorage = Readonly<
  Pick<Storage, "getItem" | "removeItem" | "setItem">
>;

/** The browser kept no storage, such as a private window that refuses it. */
export class RoomCodeStorageFailed extends Schema.TaggedError<RoomCodeStorageFailed>()(
  "RoomCodeStorageFailed",
  {}
) {}

/** The session storage key of the code scanned for one sitting. */
function roomCodeKey(sittingId: string) {
  return `nakafa-room-code:${sittingId}`;
}

/** The sitting a room address names: `/sittings/<id>` on the school host, and no deeper page. */
const SITTING_PATH = /^\/sittings\/([^/]+)\/?$/;

const storageOf = Effect.fn("exams.sitting.join.storage")(function* (
  storage?: RoomCodeStorage
) {
  if (storage) {
    return storage;
  }
  return yield* Effect.try({
    try: () => window.sessionStorage,
    catch: () => new RoomCodeStorageFailed(),
  });
});

/**
 * Keeps the code a signed-out student scanned while they sign in, for the sitting the address
 * names, so the sitting's page still enters with it after the sign-in drops the `#`. An address
 * that names no sitting or carries no code keeps nothing.
 */
export const keepRoomCode = Effect.fn("exams.sitting.join.keep")(function* (
  pathname: string,
  hash: string,
  storage?: RoomCodeStorage
) {
  const sittingId = Option.fromNullishOr(SITTING_PATH.exec(pathname)?.[1]);
  const token = scannedToken(hash);
  if (Option.isNone(sittingId) || Option.isNone(token)) {
    return;
  }
  const target = yield* storageOf(storage);
  yield* Effect.try({
    try: () => target.setItem(roomCodeKey(sittingId.value), token.value),
    catch: () => new RoomCodeStorageFailed(),
  });
});

/**
 * Takes the code kept for one sitting, once: it is removed as it is read, so a later visit to the
 * sitting never enters with a code that the proctor may have changed since. Storage that fails
 * reads as no code, since the student can still type the token.
 */
export const takeRoomCode = Effect.fn("exams.sitting.join.take")(function* (
  sittingId: string,
  storage?: RoomCodeStorage
) {
  const read = Effect.gen(function* () {
    const target = yield* storageOf(storage);
    return yield* Effect.try({
      try: () => {
        const kept = target.getItem(roomCodeKey(sittingId));
        target.removeItem(roomCodeKey(sittingId));
        return kept;
      },
      catch: () => new RoomCodeStorageFailed(),
    });
  });
  const kept = yield* read.pipe(
    Effect.catchTag("RoomCodeStorageFailed", () => Effect.succeed(null))
  );
  return Option.flatMap(Option.fromNullishOr(kept), (value) =>
    scannedToken(value)
  );
});

/**
 * The code a student brings to a room's page: the one after the `#` of the address, else the one
 * kept across the sign-in, which is taken either way, so a later visit never brings it again.
 */
export const roomCodeOf = Effect.fn("exams.sitting.join.code")(function* (
  sittingId: string,
  hash: string
) {
  const kept = yield* takeRoomCode(sittingId);
  return Option.orElse(scannedToken(hash), () => kept);
});
