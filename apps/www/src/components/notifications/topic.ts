import { Match, Schema } from "effect";
import type { ListNotification } from "@/components/notifications/state";

/** The tabs of the inbox, the first of them every row. */
export const InboxTopic = Schema.Literals(["all", "comments", "school"]);

/** The tabs of the inbox inside a school, where a reply to a comment never shows. */
export const SchoolInboxTopic = Schema.Literals(["all", "school"]);

/**
 * The tab of what happened. Every kind names its tab, so a new kind does not compile until it has one. Whatever happens
 * in a school stands under School, and a reply to a comment under Comments.
 */
const topicOf = Match.type<ListNotification["changeType"]>().pipe(
  Match.whenOr(
    "announcement.posted",
    "assignment.published",
    "exam.reminder",
    "exam.starting",
    "forum.mentioned",
    "grade.released",
    "person.invited",
    () => "school"
  ),
  Match.when("comment.replied", () => "comments"),
  Match.exhaustive
);

/** Whether what happened shows under a tab. */
export function inTopic(
  change: ListNotification["changeType"],
  topic: typeof InboxTopic.Type
) {
  return topic === "all" || topicOf(change) === topic;
}
