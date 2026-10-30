import { Effect, Option } from "effect";
import { readSittingDevice } from "@/components/exams/sitting/device";
import { scannedToken, takeRoomCode } from "@/components/exams/sitting/scan";

/**
 * The address that a room's QR code opens: the sitting's page on the school host the proctor is
 * on, with the token after the `#`. A browser never sends what follows the `#` to a server, so the
 * token stays out of request logs, and the sitting's page reads it to enter at once.
 */
export function roomJoinAddress(
  origin: string,
  sittingId: string,
  token: string
) {
  const address = new URL(`/sittings/${sittingId}`, origin);
  address.hash = token;
  return address.href;
}

/**
 * The token that a sitting's page enters with by itself once the sitting has opened. The device this
 * browser keeps owns its attempt, so it enters with no token. Otherwise the page enters with the code the
 * student scanned: the one after the `#` of the address, else the one kept across the sign-in, which is
 * taken either way. None means the student types the token.
 */
export const roomEntryOf = Effect.fn("exams.sitting.join.entry")(function* (
  sittingId: string,
  hash: string
) {
  const kept = yield* takeRoomCode(sittingId);
  if (Option.isSome(yield* readSittingDevice(sittingId))) {
    return Option.some("");
  }
  return Option.orElse(scannedToken(hash), () => kept);
});
