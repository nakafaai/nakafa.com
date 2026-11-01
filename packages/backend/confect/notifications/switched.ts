import type { GenericId } from "@confect/core";
import type { NoticePreferencesDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  noticePreferenceValidator,
  PreferenceChannel,
} from "@repo/backend/confect/notifications/preference";
import type { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Effect, Option } from "effect";

/** The row that switched a channel of a kind off for a Person, if they did. */
export const switchedOff = Effect.fn("notifications.switched.off")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  kind: typeof NoticeKind.Type,
  channel: typeof PreferenceChannel.Type
) {
  return yield* (yield* DatabaseReader)
    .table("noticePreferences")
    .index("by_personId_and_kind_and_channel", (query) =>
      query.eq("personId", personId).eq("kind", kind).eq("channel", channel)
    )
    .first()
    .pipe(Effect.orDie);
});

/** The row that switched a channel of a kind off for an account, if it did. */
export const accountSwitchedOff = Effect.fn(
  "notifications.switched.accountOff"
)(function* (
  userId: GenericId.GenericId<"users">,
  kind: typeof NoticeKind.Type,
  channel: typeof PreferenceChannel.Type
) {
  return yield* (yield* DatabaseReader)
    .table("noticePreferences")
    .index("by_userId_and_kind_and_channel", (query) =>
      query.eq("userId", userId).eq("kind", kind).eq("channel", channel)
    )
    .first()
    .pipe(Effect.orDie);
});

/** Moves one switch: on deletes the row that holds it off, and off writes it. Repeating a choice changes nothing. */
export const moveSwitch = Effect.fn("notifications.switched.move")(function* (
  found: Option.Option<NoticePreferencesDoc>,
  on: boolean,
  row: typeof noticePreferenceValidator.Type
) {
  const writer = yield* DatabaseWriter;
  if (on && Option.isSome(found)) {
    yield* writer
      .table("noticePreferences")
      .delete(found.value._id)
      .pipe(Effect.orDie);
  }
  if (!(on || Option.isSome(found))) {
    yield* writer.table("noticePreferences").insert(row).pipe(Effect.orDie);
  }
});
