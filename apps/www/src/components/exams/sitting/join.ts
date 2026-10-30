import type {
  HeldAttempt,
  SittingView,
} from "@repo/backend/confect/exams/sittings/contract";
import { Effect, Option } from "effect";
import { isActive } from "@/components/exams/sitting/attempt";
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

/**
 * Whether a sitting's page enters by itself: the sitting has opened, and the student holds no attempt
 * yet or one that is still active, so a finished attempt shows how it ended instead.
 */
export function entersBySelf(view: {
  readonly attempt: Pick<typeof HeldAttempt.Type, "state"> | null;
  readonly sitting: Pick<typeof SittingView.Type, "state">;
}) {
  return (
    view.sitting.state !== "scheduled" &&
    (view.attempt === null || isActive(view.attempt.state))
  );
}
