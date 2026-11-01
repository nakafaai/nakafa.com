import { Table } from "@confect/core";
import { noticePreferenceValidator } from "@repo/backend/confect/notifications/preference";

/** The channels each Person or account switched off, found by the send that asks. */
export default Table.make(() => noticePreferenceValidator)
  .index("by_personId_and_kind_and_channel", ["personId", "kind", "channel"])
  .index("by_userId_and_kind_and_channel", ["userId", "kind", "channel"]);
