import { readMaterialDomain } from "@repo/contents/_types/material/identity";
import { describe, expect, it } from "vitest";

describe("material identity", () => {
  it("reads only a registered subject from a complete lesson key", () => {
    expect(readMaterialDomain("lesson.mathematics.function-composition")).toBe(
      "mathematics"
    );
    expect(readMaterialDomain("lesson.unknown.topic")).toBeUndefined();
    expect(readMaterialDomain("mathematics.topic")).toBeUndefined();
    expect(readMaterialDomain("lesson.mathematics")).toBeUndefined();
    expect(
      readMaterialDomain("lesson.mathematics.topic.extra")
    ).toBeUndefined();
  });
});
