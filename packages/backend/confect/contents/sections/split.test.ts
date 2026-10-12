import { describe, expect, it } from "@effect/vitest";
import {
  READ_START_SECTION,
  splitSections,
} from "@repo/backend/confect/contents/sections/split";
import { Array as Arr } from "effect";

const lesson = Arr.join(
  [
    "# Matriks",
    "Pengantar singkat.",
    "## Bentuk Matriks",
    "Isi bentuk.",
    "### Contoh Satu",
    "Isi contoh satu.",
    "### Contoh Dua",
    "Isi contoh dua.",
    "## Penutup",
    "Isi penutup.",
  ],
  "\n"
);

describe("section splitting", () => {
  it("opens with the text before the first heading and then follows the headings", () => {
    const sections = splitSections(lesson);
    expect(Arr.map(sections, ({ slug }) => slug)).toEqual([
      READ_START_SECTION,
      "bentuk-matriks",
      "contoh-satu",
      "contoh-dua",
      "penutup",
    ]);
    expect(sections[0]?.text).toBe("# Matriks\nPengantar singkat.");
    expect(sections[1]?.text).toBe("## Bentuk Matriks\nIsi bentuk.");
  });

  it("names the headings that lead to each section", () => {
    expect(Arr.map(splitSections(lesson), ({ path }) => path)).toEqual([
      [],
      ["Bentuk Matriks"],
      ["Bentuk Matriks", "Contoh Satu"],
      ["Bentuk Matriks", "Contoh Dua"],
      ["Penutup"],
    ]);
  });

  it("starts a level-three heading with no level-two heading above it on its own", () => {
    const [section] = splitSections("### Contoh\nIsi.");
    expect(section).toMatchObject({ path: ["Contoh"], slug: "contoh" });
  });

  it("numbers a repeated heading so every slug stays unique", () => {
    const sections = splitSections(
      "## Contoh\nSatu.\n## Contoh\nDua.\n## Contoh\nTiga."
    );
    expect(Arr.map(sections, ({ slug }) => slug)).toEqual([
      "contoh",
      "contoh-2",
      "contoh-3",
    ]);
  });

  it("makes no opening section when the text starts with a heading", () => {
    const sections = splitSections("## Satu\nIsi.");
    expect(Arr.map(sections, ({ slug }) => slug)).toEqual(["satu"]);
  });

  it("ignores a closing hash run and a level-one heading in a section", () => {
    const [section] = splitSections("## Satu ##\n# Judul\nIsi.");
    expect(section).toMatchObject({ slug: "satu", title: "Satu" });
    expect(section?.text).toContain("# Judul");
  });
});
