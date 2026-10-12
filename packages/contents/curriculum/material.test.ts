import { describe, expect, it } from "@effect/vitest";
import { PiIcon } from "@hugeicons/core-free-icons";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { PRESENTED_MATERIAL_DOMAINS } from "@repo/contents/taxonomy";
import { Array as Arr } from "effect";

describe("getMaterialIcons", () => {
  it("gives mathematics the pi icon", () => {
    expect(getMaterialIcons("mathematics")).toEqual([PiIcon]);
  });

  it("gives every presented subject one icon that no other subject and no spare has", () => {
    const icons = Arr.flatMap(PRESENTED_MATERIAL_DOMAINS, (material) =>
      getMaterialIcons(material)
    );
    const all = Arr.appendAll(icons, SPARE_ICONS);

    expect(icons).toHaveLength(PRESENTED_MATERIAL_DOMAINS.length);
    expect(Arr.dedupe(all)).toHaveLength(all.length);
  });

  it("offers the spare icons to a subject that it does not know yet", () => {
    expect(getMaterialIcons("unknown-material")).toBe(SPARE_ICONS);
  });
});
