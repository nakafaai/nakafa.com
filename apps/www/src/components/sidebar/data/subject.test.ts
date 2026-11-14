import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
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

  it("links each grade to its localized curriculum path", () => {
    const items = Arr.flatMap(subjectMenu, (category) => category.items);

    expect(
      Arr.map(items, (item) => ({
        de: getSubjectMenuHref(item, "de"),
        en: getSubjectMenuHref(item, "en"),
        id: getSubjectMenuHref(item, "id"),
      }))
    ).toEqual([
      {
        de: "/lehrplaene/merdeka/klasse-10",
        en: "/curriculum/merdeka/class-10",
        id: "/kurikulum/merdeka/kelas-10",
      },
      {
        de: "/lehrplaene/merdeka/klasse-11",
        en: "/curriculum/merdeka/class-11",
        id: "/kurikulum/merdeka/kelas-11",
      },
      {
        de: "/lehrplaene/merdeka/klasse-12",
        en: "/curriculum/merdeka/class-12",
        id: "/kurikulum/merdeka/kelas-12",
      },
    ]);
  });
});
