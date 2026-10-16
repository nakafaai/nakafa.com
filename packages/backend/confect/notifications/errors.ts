import { Effect, Schema } from "effect";

const notificationNotFound = Schema.Literal("NOTIFICATION_NOT_FOUND");
const notificationCursorInvalid = Schema.Literal("NOTIFICATION_CURSOR_INVALID");

/**
 * No inbox row of the caller has this ID. A row of another account, or of a
 * Person the account does not hold, gets the same answer, so an ID probe learns
 * nothing.
 */
export class NotificationNotFound extends Schema.TaggedError<NotificationNotFound>()(
  "NotificationNotFound",
  {
    code: notificationNotFound.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(notificationNotFound.literal)
      )
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("This notification does not exist.")
      )
    ),
  }
) {}

/** The page cursor of the inbox list is not one that the list returned. */
export class NotificationCursorInvalid extends Schema.TaggedError<NotificationCursorInvalid>()(
  "NotificationCursorInvalid",
  {
    code: notificationCursorInvalid.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(notificationCursorInvalid.literal)
      )
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("The page cursor of the inbox is not valid.")
      )
    ),
  }
) {}
