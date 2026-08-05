import { BulbIcon, PiIcon } from "@hugeicons/core-free-icons";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { SUBJECT_MATERIALS } from "@repo/contents/_types/taxonomy";
import { describe, expect, it } from "vitest";

describe("getMaterialIcon", () => {
  it("resolves mathematics to the pi icon", () => {
    expect(getMaterialIcon("mathematics")).toBe(PiIcon);
  });

  it("resolves every known material domain without the fallback icon", () => {
    for (const material of SUBJECT_MATERIALS) {
      expect(getMaterialIcon(material)).not.toBe(BulbIcon);
    }
  });

  it("uses the fallback icon for unknown material domains", () => {
    expect(getMaterialIcon("unknown-material")).toBe(BulbIcon);
  });
});
