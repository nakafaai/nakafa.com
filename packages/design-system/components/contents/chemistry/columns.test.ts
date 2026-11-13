import { describe, expect, it } from "@effect/vitest";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";

describe("toggle columns", () => {
  it("fits every count of choices without an empty cell", () => {
    expect(toggleColumns(2)).toBe("2");
    expect(toggleColumns(3)).toBe("3");
    expect(toggleColumns(4)).toBe("4");
    expect(toggleColumns(5)).toBe("auto");
  });
});
