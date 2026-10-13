import { describe, expect, it } from "@effect/vitest";
import { PiIcon } from "@hugeicons/core-free-icons";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";

describe("getMaterialIcons", () => {
  it("gives mathematics the pi icon", () => {
    expect(getMaterialIcons("mathematics")).toEqual([PiIcon]);
  });

  it("offers the spare icons to a subject that it does not know yet", () => {
    expect(getMaterialIcons("unknown-material")).toBe(SPARE_ICONS);
  });
});
