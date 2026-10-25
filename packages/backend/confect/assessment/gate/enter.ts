import { standingOf } from "@repo/backend/confect/assessment/gate/device";
import {
  AttemptClosed,
  AttemptRefused,
  Closed,
  DeviceRetired,
  Missing,
  NotOpen,
  OtherDevice,
  PlaceLocked,
  type TokenRefused,
  type TooManyTries,
} from "@repo/backend/confect/assessment/gate/refusal";
import {
  type Attempt,
  acceptsWrites,
  type DeviceId,
} from "@repo/backend/confect/assessment/gate/store";
import { Clock, Effect, Option, Schema } from "effect";

/** When a target opens to new attempts, and when it closes, in server milliseconds. */
const Window = Schema.Struct({
  closesAt: Schema.Finite,
  state: Schema.Literals(["scheduled", "open", "closed"]),
});
type Window = typeof Window.Type;

/**
 * What an entry sees of its target: the target itself as its store loaded it, the
 * caller's attempt in it when they hold one, whether a lock refuses the place, and the
 * window the target opens and closes in.
 */
export interface Entrance<Sitting, Held extends Attempt> {
  readonly held: Option.Option<Held>;
  readonly locked: boolean;
  readonly sitting: Sitting;
  readonly window: Window;
}

/** Refuses one entry with the first rule it failed. */
function refuse(reason: AttemptRefused["reason"]) {
  return Effect.fail(new AttemptRefused({ reason }));
}

/** Refuses a window that has not opened, or has closed for new attempts. */
const checkWindow = Effect.fn("assessment.gate.enter.window")(function* (
  window: Window,
  now: number
) {
  if (window.state === "scheduled") {
    return yield* refuse(new NotOpen());
  }
  if (window.state === "closed" || now >= window.closesAt) {
    return yield* refuse(new Closed());
  }
});

/**
 * Refuses a held attempt that is closed or that a retired device holds, and says how the
 * device stands with the attempt otherwise. A bound device resumes without a token.
 */
const standingOfHeld = Effect.fn("assessment.gate.enter.held")(function* (
  held: Attempt,
  device: DeviceId,
  now: number
) {
  if (!acceptsWrites(held.state) || now >= held.deadline) {
    return yield* refuse(new AttemptClosed());
  }
  const standing = standingOf(held.binding, device);
  if (standing === "retired") {
    return yield* refuse(new DeviceRetired());
  }
  return standing;
});

/**
 * Builds the entry gate over the store of one kind of target. An entry admits its
 * owner to an attempt, once: the device that owns the attempt enters without a token,
 * and any entry without a held attempt needs an open window and a token that the store
 * verifies. The order is the target, the lock, the held attempt or the window, a retired
 * device (refused before any token is checked), then the token. A device other than the
 * bound one is refused only after its token verifies, so a stranger learns nothing of the
 * attempt's binding before the token is known.
 */
export function makeEntry<
  Target,
  Held extends Attempt,
  Sitting,
  Entered,
  E,
  R,
>(store: {
  /** Loads the entrance of the caller, or none when the target is not theirs to enter. */
  readonly entrance: (
    target: Target
  ) => Effect.Effect<Option.Option<Entrance<Sitting, Held>>, E, R>;
  /** Checks the token against the tries left, and counts a failed try. */
  readonly verify: (
    target: Target,
    sitting: Sitting,
    device: DeviceId,
    token: string
  ) => Effect.Effect<void, E | TokenRefused | TooManyTries, R>;
  /** Starts the caller's attempt with this device, which then owns it. */
  readonly start: (
    target: Target,
    sitting: Sitting,
    device: DeviceId,
    now: number
  ) => Effect.Effect<Entered, E, R>;
  /** Admits the device that owns the attempt again, without a token. */
  readonly resume: (held: Held, now: number) => Effect.Effect<Entered, E, R>;
  /** Binds an attempt that no device holds to this device. */
  readonly bind: (
    held: Held,
    device: DeviceId,
    now: number
  ) => Effect.Effect<Entered, E, R>;
}) {
  /** Admits the caller's device to the target, or refuses it with the first rule it failed. */
  const enter = Effect.fn("assessment.gate.enter")(function* (input: {
    readonly device: DeviceId;
    readonly target: Target;
    readonly token: string;
  }) {
    const entrance = yield* store.entrance(input.target);
    if (Option.isNone(entrance)) {
      return yield* refuse(new Missing());
    }
    const { held, locked, sitting, window } = entrance.value;
    const now = yield* Clock.currentTimeMillis;
    if (locked) {
      return yield* refuse(new PlaceLocked());
    }
    if (Option.isSome(held)) {
      const standing = yield* standingOfHeld(held.value, input.device, now);
      if (standing === "bound") {
        return yield* store.resume(held.value, now);
      }
    } else {
      yield* checkWindow(window, now);
    }
    yield* store.verify(input.target, sitting, input.device, input.token);
    if (Option.isNone(held)) {
      return yield* store.start(input.target, sitting, input.device, now);
    }
    if (standingOf(held.value.binding, input.device) !== "unbound") {
      return yield* refuse(new OtherDevice());
    }
    return yield* store.bind(held.value, input.device, now);
  });

  return { enter };
}
