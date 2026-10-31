import { Table } from "@confect/core";
import { noticePreferenceValidator } from "@repo/backend/confect/notifications/preference";

/** The channels each Person switched off, found by the send that asks. */
export default Table.make(() => noticePreferenceValidator).index(
  "by_personId_and_kind_and_channel",
  ["personId", "kind", "channel"]
);
