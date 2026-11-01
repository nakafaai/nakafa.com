import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/notifications/preferences.spec";
import { canSwitchOff } from "@repo/backend/confect/notifications/rules";
import {
  moveSwitch,
  switchedOff,
} from "@repo/backend/confect/notifications/switched";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/** Rows one member can hold: every kind on both channels. */
const PREFERENCE_PAGE = 32;

/** The channels the member switched off. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("notifications.preferences.list")(function* () {
    const { person } = yield* Member;
    const rows = yield* (yield* DatabaseReader)
      .table("noticePreferences")
      .index("by_personId_and_kind_and_channel", (query) =>
        query.eq("personId", person._id)
      )
      .take(PREFERENCE_PAGE)
      .pipe(Effect.orDie);
    return Arr.map(rows, Struct.pick(["channel", "kind"]));
  })
);

/** Switches one channel of one kind on or off. Repeating a choice changes nothing. */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("notifications.preferences.set")(function* ({ channel, kind, on }) {
    if (!canSwitchOff(kind, channel)) {
      return null;
    }
    const { person, tenant } = yield* Member;
    yield* moveSwitch(yield* switchedOff(person._id, kind, channel), on, {
      channel,
      kind,
      personId: person._id,
      tenantId: tenant._id,
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(set),
  Layer.provide(session),
  Layer.provide(member),
  GroupImpl.finalize
);
