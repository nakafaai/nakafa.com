import { describe, expect, it } from "@effect/vitest";
import { inTopic } from "@/components/notifications/topic";

describe("notifications/topic", () => {
  it("shows every row under all", () => {
    expect(inTopic("forum.mentioned", "all")).toBe(true);
  });

  it.each([
    ["forum.mentioned", "forum", "school"],
    ["exam.starting", "exams", "forum"],
    ["exam.reminder", "exams", "classes"],
    ["person.invited", "school", "exams"],
    ["assignment.published", "classes", "forum"],
    ["announcement.posted", "classes", "school"],
    ["grade.released", "classes", "exams"],
    ["comment.replied", "comments", "school"],
  ] as const)("files %s under %s and not under %s", (change, topic, other) => {
    expect(inTopic(change, topic)).toBe(true);
    expect(inTopic(change, other)).toBe(false);
  });
});
