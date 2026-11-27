import { describe, expect, it } from "@effect/vitest";
import {
  roomState,
  waterForm,
} from "@repo/design-system/components/contents/biology/lipid/packing";

describe("roomState and waterForm", () => {
  it("maps saturated to solid, unsaturated to liquid, triglyceride to droplet, phospholipid to bilayer", () => {
    expect(roomState("saturated")).toBe("solid");
    expect(roomState("unsaturated")).toBe("liquid");
    expect(waterForm("triglyceride")).toBe("droplet");
    expect(waterForm("phospholipid")).toBe("bilayer");
  });
});
