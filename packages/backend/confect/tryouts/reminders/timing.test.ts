import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  hoursLeft,
  reminderTime,
  variantOf,
} from "@repo/backend/confect/tryouts/reminders/timing";
import { Duration, Schema } from "effect";

const HOUR = Duration.toMillis(Duration.hours(1));

/** 13:00 in Jakarta, outside quiet hours. */
const AFTERNOON = Date.UTC(2026, 6, 9, 6, 0);

/** 23:00 in Jakarta, inside quiet hours, which end at 07:00, eight hours later. */
const NIGHT = Date.UTC(2026, 6, 9, 16, 0);

const attemptId = Schema.decodeUnknownSync(Id("tryoutAttempts"));

describe("tryouts/reminders/timing", () => {
  it("lets a reminder leave at once outside quiet hours, at 07:00 in Jakarta when that is still in time, and never otherwise", () => {
    expect(reminderTime(AFTERNOON, AFTERNOON + HOUR)).toEqual({ _tag: "Now" });
    expect(reminderTime(NIGHT, NIGHT + 9 * HOUR)).toEqual({
      _tag: "At",
      at: NIGHT + 8 * HOUR,
    });
    expect(reminderTime(NIGHT, NIGHT + 8 * HOUR)).toEqual({ _tag: "Never" });
  });

  it("splits attempts between the two wordings by their ID, the same way every time", () => {
    expect(variantOf(attemptId("a"))).toBe("b");
    expect(variantOf(attemptId("b"))).toBe("a");
    expect(variantOf(attemptId("b"))).toBe(variantOf(attemptId("b")));
  });

  it("counts the whole hours left before the end, and never fewer than one", () => {
    expect(hoursLeft(AFTERNOON + 6 * HOUR, AFTERNOON)).toBe(6);
    expect(hoursLeft(AFTERNOON + 5.5 * HOUR, AFTERNOON)).toBe(5);
    expect(hoursLeft(AFTERNOON + HOUR / 2, AFTERNOON)).toBe(1);
  });
});
