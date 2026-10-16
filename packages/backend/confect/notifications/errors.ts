import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * No inbox row of the caller has this ID. A row of another account, or of a
 * Person the account does not hold, gets the same answer, so an ID probe learns
 * nothing.
 */
export class NotificationNotFound extends Schema.TaggedError<NotificationNotFound>()(
  "NotificationNotFound",
  refusal("NOTIFICATION_NOT_FOUND", "This notification does not exist.")
) {}

/**
 * The account holds more Persons than one inbox request reads. The request is
 * refused, so no answer holds some of the account's rows and not others.
 */
export class NotificationScopeTooLarge extends Schema.TaggedError<NotificationScopeTooLarge>()(
  "NotificationScopeTooLarge",
  refusal(
    "NOTIFICATION_SCOPE_TOO_LARGE",
    "This account holds too many schools for its inbox."
  )
) {}

/** The page cursor of the inbox list is not one that the list returned. */
export class NotificationCursorInvalid extends Schema.TaggedError<NotificationCursorInvalid>()(
  "NotificationCursorInvalid",
  refusal(
    "NOTIFICATION_CURSOR_INVALID",
    "The page cursor of the inbox is not valid."
  )
) {}
