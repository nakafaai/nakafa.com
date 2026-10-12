import { describe, expect, it } from "@effect/vitest";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { getTileShifts } from "@repo/design-system/lib/tile";
import { Array as Arr } from "effect";
import { getMaterialLooks } from "@/components/home/look";

/** The most lessons that one home list shows: the trending list holds six. */
const LONGEST_LIST = 6;

/** Lessons of one subject, as the rows of one home list. */
function lessonsOf(materialDomain: string, count: number) {
  return Arr.makeBy(count, (index) => ({
    content_id: `lesson-${index}`,
    materialDomain,
  }));
}

describe("getMaterialLooks", () => {
  it("gives six lessons of one subject six different icons of that subject", () => {
    const looks = getMaterialLooks(lessonsOf("mathematics", LONGEST_LIST));
    const icons = Arr.map(looks, ({ icon }) => icon);

    expect(Arr.dedupe(icons)).toHaveLength(LONGEST_LIST);
    expect(
      Arr.every(icons, (icon) =>
        Arr.contains(getLessonIcons("mathematics"), icon)
      )
    ).toBe(true);
  });

  it("gives lessons of a subject that it does not know yet different spare icons", () => {
    const looks = getMaterialLooks(lessonsOf("pottery", LONGEST_LIST));
    const icons = Arr.map(looks, ({ icon }) => icon);

    expect(Arr.dedupe(icons)).toHaveLength(LONGEST_LIST);
    expect(Arr.every(icons, (icon) => Arr.contains(SPARE_ICONS, icon))).toBe(
      true
    );
  });

  it("keeps the icon of a lesson that comes first, whatever follows it", () => {
    const lessons = lessonsOf("physics", LONGEST_LIST);

    expect(getMaterialLooks(Arr.take(lessons, 1))).toEqual(
      Arr.take(getMaterialLooks(lessons), 1)
    );
  });

  it("turns the tiles of one list as the seeds of the lessons ask", () => {
    const lessons = lessonsOf("chemistry", LONGEST_LIST);

    expect(Arr.map(getMaterialLooks(lessons), ({ shift }) => shift)).toEqual(
      getTileShifts(Arr.map(lessons, ({ content_id }) => content_id))
    );
  });

  it("gives an empty list nothing", () => {
    expect(getMaterialLooks([])).toEqual([]);
  });
});
