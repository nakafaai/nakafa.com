import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { subjectMenu } from "@/components/sidebar/data/subject";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";

describe("subject menu", () => {
  it("draws each grade with the icon of its own navigation key, so no two rows share one", () => {
    const items = Arr.flatMap(subjectMenu, (category) => category.items);
    const icons = Arr.map(items, ({ icon }) => icon);

    expect(icons).toEqual([
      CURRICULUM_NAVIGATION_ICONS["grade-10"],
      CURRICULUM_NAVIGATION_ICONS["grade-11"],
      CURRICULUM_NAVIGATION_ICONS["grade-12"],
    ]);
    expect(Arr.dedupe(icons)).toHaveLength(items.length);
  });
});
