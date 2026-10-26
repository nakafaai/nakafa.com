import { Effect, Schema } from "effect";

const actionClosed = Schema.Literal("ACTION_CLOSED");

/**
 * A client whose action list names an action the catalog does not open to the
 * Integration role. The whole list is refused, so no client holds part of one.
 */
export class ActionClosed extends Schema.TaggedError<ActionClosed>()(
  "ActionClosed",
  {
    code: actionClosed.pipe(
      Schema.withConstructorDefault(Effect.succeed(actionClosed.literal))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(
          "The catalog does not open this action to an integration client."
        )
      )
    ),
  }
) {}

const deviceUnknown = Schema.Literal("DEVICE_UNKNOWN");

/** A user code that names no pending device of the school: mistyped, expired, or already decided. */
export class DeviceUnknown extends Schema.TaggedError<DeviceUnknown>()(
  "DeviceUnknown",
  {
    code: deviceUnknown.pipe(
      Schema.withConstructorDefault(Effect.succeed(deviceUnknown.literal))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(
          "No device waits with this code. Check the code on the device."
        )
      )
    ),
  }
) {}
