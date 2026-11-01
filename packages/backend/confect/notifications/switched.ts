import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PreferenceChannel } from "@repo/backend/confect/notifications/preference";
import type { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Effect } from "effect";

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
