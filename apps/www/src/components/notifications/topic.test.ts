import { describe, expect, it } from "@effect/vitest";
import { inTopic } from "@/components/notifications/topic";

describe("notifications/topic", () => {
  it("shows every row under all", () => {
    expect(inTopic("forum.mentioned", "all")).toBe(true);
  });

  it.each([
    "announcement.posted",
    "assignment.published",
    "exam.reminder",
    "exam.starting",
    "forum.mentioned",
    "grade.released",
    "person.invited",
  ] as const)("files %s under school and not under comments", (change) => {
    expect(inTopic(change, "school")).toBe(true);
    expect(inTopic(change, "comments")).toBe(false);
  });

  it("files a reply under comments and not under school", () => {
    expect(inTopic("comment.replied", "comments")).toBe(true);
    expect(inTopic("comment.replied", "school")).toBe(false);
  });
});
