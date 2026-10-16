import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  NotificationCursorInvalid,
  NotificationNotFound,
} from "@repo/backend/confect/notifications/errors";
import { NotificationView } from "@repo/backend/confect/notifications/schema";
import { Schema } from "effect";

/**
 * The inbox of the signed-in account: the rows of every school whose Person the
 * account holds. The account reads its rows, marks one read, or marks them all.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      item: () => NotificationView,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotificationCursorInvalid,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "read",
      args: () => ({ notificationId: Id("notifications") }),
      returns: () => NotificationView,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotificationNotFound,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "readAll",
      args: () => ({}),
      returns: () => Schema.Null,
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  );
