import { Match, Schema } from "effect";
import type { ListNotification } from "@/components/notifications/state";

/** The topics a reader filters the inbox by, the first of them every row. */
export const InboxTopic = Schema.Literals([
  "all",
  "exams",
  "classes",
  "forum",
  "school",
  "comments",
]);

/** The topic of what happened: anything of a class that is not its forum is the class's. */
const topicOf = Match.type<ListNotification["changeType"]>().pipe(
  Match.when("forum.mentioned", () => "forum"),
  Match.whenOr("exam.reminder", "exam.starting", () => "exams"),
  Match.when("person.invited", () => "school"),
  Match.when("comment.replied", () => "comments"),
  Match.orElse(() => "classes")
);

/** Whether what happened shows under a topic. */
export function inTopic(
  change: ListNotification["changeType"],
  topic: typeof InboxTopic.Type
) {
  return topic === "all" || topicOf(change) === topic;
}
