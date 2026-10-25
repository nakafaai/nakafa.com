import { expect, it } from "@effect/vitest";
import { readLimitCopy } from "@/components/ai/message/limit";

it("gives the links limit copy to the capabilities that send links", () => {
  expect(readLimitCopy("nakafa")).toBe("activity.source-limit");
  expect(readLimitCopy("deepResearch")).toBe("activity.source-limit");
});

it("gives no limit copy to a capability that has none, so it never shows another capability's wording", () => {
  expect(readLimitCopy("math")).toBeNull();
  expect(readLimitCopy("memory")).toBeNull();
  expect(readLimitCopy("unknown")).toBeNull();
});
