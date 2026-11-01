import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/notifications/personal.spec";
import {
  canSwitchOff,
  routeOf,
} from "@repo/backend/confect/notifications/rules";
import {
  accountSwitchedOff,
  moveSwitch,
} from "@repo/backend/confect/notifications/switched";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** Rows one account can hold: every kind on both channels. */
const PREFERENCE_PAGE = 32;

/** The channels the account switched off. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("notifications.personal.list")(function* () {
    const { appUser } = yield* requireAuth();
    const rows = yield* (yield* DatabaseReader)
      .table("noticePreferences")
      .index("by_userId_and_kind_and_channel", (query) =>
        query.eq("userId", appUser._id)
      )
      .take(PREFERENCE_PAGE)
      .pipe(Effect.orDie);
    return Arr.map(rows, Struct.pick(["channel", "kind"]));
  })
);

/** Switches one channel of a notice the account holds itself on or off. Repeating a choice changes nothing. */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("notifications.personal.set")(function* ({ channel, kind, on }) {
    if (
      Option.isNone(routeOf(kind, "commenter")) ||
      !canSwitchOff(kind, channel)
    ) {
      return null;
    }
    const { appUser } = yield* requireAuth();
    yield* moveSwitch(
      yield* accountSwitchedOff(appUser._id, kind, channel),
      on,
      { channel, kind, userId: appUser._id }
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(set),
  Layer.provide(session),
  GroupImpl.finalize
);
