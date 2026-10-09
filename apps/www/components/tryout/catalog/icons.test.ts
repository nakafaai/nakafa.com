import { describe, expect, it } from "@effect/vitest";
import {
  BulbIcon,
  Calendar03Icon,
  LanguageSkillIcon,
  Mortarboard02Icon,
} from "@hugeicons/core-free-icons";
import { getMaterialIcon } from "@repo/contents/curriculum/material";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr } from "effect";
import {
  getTryoutExamIcon,
  getTryoutSubjectIcon,
  getTryoutTrackIcon,
} from "@/components/tryout/catalog/icons";

/** Serialize an icon definition for stable structural assertions. */
function serializeIcon(icon: unknown) {
  return encodeJsonText(icon);
}

/** UTBK-SNBT subtests under their official names, in exam order. */
const SNBT_SECTIONS = [
  "general-reasoning",
  "general-knowledge-and-understanding",
  "reading-comprehension-and-writing",
  "quantitative-knowledge",
  "literacy-in-indonesian",
  "literacy-in-english",
  "mathematical-reasoning",
];

describe("try-out icons", () => {
  it("keeps visible exam selector options unique by icon", () => {
    const icons = Arr.map(["snbt", "tka"], (key) =>
      serializeIcon(getTryoutExamIcon(key))
    );

    expect(Arr.dedupe(icons).length).toBe(icons.length);
  });

  it("returns a default exam icon for future unsupported exam keys", () => {
    expect(getTryoutExamIcon("unknown-exam")).toBeTruthy();
  });

  it("gives every UTBK-SNBT subtest its own icon", () => {
    const icons = Arr.map(SNBT_SECTIONS, (key) => getTryoutSubjectIcon(key));

    expect(icons).not.toContain(BulbIcon);
    expect(Arr.dedupe(Arr.map(icons, serializeIcon)).length).toBe(
      SNBT_SECTIONS.length
    );
  });

  it("shares one icon between a subject track and its section", () => {
    expect(getTryoutTrackIcon("subject", "english-language")).toBe(
      getTryoutSubjectIcon("english-language")
    );
    expect(getTryoutSubjectIcon("english-language")).toBe(LanguageSkillIcon);
  });

  it("reuses curriculum material icons for curriculum subjects", () => {
    expect(getTryoutSubjectIcon("compulsory-mathematics")).toBe(
      getMaterialIcon("mathematics")
    );
    expect(getTryoutSubjectIcon("physics")).toBe(getMaterialIcon("physics"));
  });

  it("gives year tracks a calendar and unknown subjects the default icon", () => {
    expect(getTryoutTrackIcon("year", "2027")).toBe(Calendar03Icon);
    expect(getTryoutTrackIcon("subject", "unknown-track")).toBe(BulbIcon);
  });

  it("gives institution tracks a mortarboard whatever their key", () => {
    expect(getTryoutTrackIcon("institution", "studienkolleg")).toBe(
      Mortarboard02Icon
    );
    expect(getTryoutTrackIcon("institution", "physics")).toBe(
      Mortarboard02Icon
    );
  });
});
