import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  deadlineOf,
  localDeadline,
} from "@/components/tenant/classes/tasks/deadline";

describe("task deadlines", () => {
  it("reads a local date and time as one instant, and writes the same field back", () => {
    const instant = Option.getOrThrow(deadlineOf("2026-10-30T23:59"));
    expect(localDeadline(instant)).toBe("2026-10-30T23:59");
  });

  it("names no instant for a value that is not a date and time", () => {
    expect(deadlineOf("")).toEqual(Option.none());
    expect(deadlineOf("besok")).toEqual(Option.none());
  });
});
