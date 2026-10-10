import { expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { isProblem } from "@/components/ai/message/state";

it("reads only denied, failed and limit as a problem", () => {
  const states = [
    "denied",
    "done",
    "empty",
    "failed",
    "limit",
    "partial",
    "running",
    "stopped",
  ] as const;
  expect(Arr.filter(states, isProblem)).toEqual(["denied", "failed", "limit"]);
});
