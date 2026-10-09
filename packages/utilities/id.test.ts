import { describe, expect, it } from "@effect/vitest";
import { createStableId } from "@repo/utilities/id";

const STABLE_ID_PATTERN = /^json-ld-[a-z0-9]+$/;

describe("createStableId", () => {
  it("returns the same id for the same input", () => {
    expect(createStableId("json-ld", "Nakafa")).toBe(
      createStableId("json-ld", "Nakafa")
    );
  });

  it("keeps the prefix readable", () => {
    expect(createStableId("json-ld", "Nakafa")).toMatch(STABLE_ID_PATTERN);
  });

  it("changes when the input changes", () => {
    expect(createStableId("json-ld", "Nakafa")).not.toBe(
      createStableId("json-ld", "Nakafa AI")
    );
  });

  it("supports an empty payload", () => {
    expect(createStableId("content", "")).toBe("content-0");
  });
});
