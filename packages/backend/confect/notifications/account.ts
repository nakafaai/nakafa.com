import { reminderNotice } from "@repo/backend/confect/notifications/reminder";
import { replyNotice } from "@repo/backend/confect/notifications/reply";
import type { AccountRow } from "@repo/backend/confect/notifications/schema";
import { Match } from "effect";

/** One row of an account itself as the wire shows it: a reply to its comment, or a reminder of its running try-out. */
export const accountNotice = (row: AccountRow) =>
  Match.value(row).pipe(
    Match.discriminatorsExhaustive("changeType")({
      "comment.replied": replyNotice,
      "tryout.reminder": reminderNotice,
    })
  );
