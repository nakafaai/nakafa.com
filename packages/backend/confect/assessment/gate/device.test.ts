import { describe, expect, it } from "@effect/vitest";
import { standingOf } from "@repo/backend/confect/assessment/gate/device";

describe("assessment/gate/device", () => {
  it("tells how one device stands with each kind of binding", () => {
    expect(standingOf({ kind: "free" }, "device-a")).toBe("free");
    expect(
      standingOf({ device: "device-a", kind: "bound", retired: [] }, "device-a")
    ).toBe("bound");
    expect(
      standingOf({ device: "device-a", kind: "bound", retired: [] }, "device-b")
    ).toBe("other");
    expect(
      standingOf(
        { device: "device-a", kind: "bound", retired: ["device-b"] },
        "device-b"
      )
    ).toBe("retired");
    expect(standingOf({ kind: "unbound", retired: [] }, "device-b")).toBe(
      "unbound"
    );
    expect(
      standingOf({ kind: "unbound", retired: ["device-b"] }, "device-b")
    ).toBe("retired");
  });
});
