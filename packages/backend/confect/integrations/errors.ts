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
