import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  deadlineOf,
  localDeadline,
} from "@/components/tenant/classes/tasks/deadline";

describe("task deadlines", () => {
  it("reads a date and time on the school's clock, and writes the same field back", () => {
    const instant = Option.getOrThrow(
      deadlineOf("2026-10-30T23:59", "Asia/Makassar")
    );
    expect(instant).toBe(Date.UTC(2026, 9, 30, 15, 59));
    expect(localDeadline(instant, "Asia/Makassar")).toBe("2026-10-30T23:59");
    expect(localDeadline(instant, "Asia/Jakarta")).toBe("2026-10-30T22:59");
  });

  it("names no instant for a value that is not a date and time", () => {
    expect(deadlineOf("", "Asia/Jakarta")).toEqual(Option.none());
    expect(deadlineOf("besok", "Asia/Jakarta")).toEqual(Option.none());
  });
});
