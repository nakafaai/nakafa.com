import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";

describe("subject menu", () => {
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
