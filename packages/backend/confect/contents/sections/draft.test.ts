import { describe, expect, it } from "@effect/vitest";
import {
  documentSections,
  embedInput,
} from "@repo/backend/confect/contents/sections/draft";
import {
  EMBED_TEXT_CHARS,
  SECTION_TEXT_CHARS,
} from "@repo/backend/confect/contents/sections/limits";
import { Array as Arr } from "effect";

const source = {
  appLocale: "id",
  contentKey: "material/lesson/matematika/matriks",
  publicPath: "materi/matematika/matriks",
  section: "material",
} as const;

const markdown = Arr.join(
  [
    "# Matriks",
    "",
    "Matriks adalah susunan bilangan dalam baris dan kolom.",
    "",
    "## Bentuk Matriks",
    "",
    "Sebuah matriks ditulis dengan tanda kurung.",
    "",
    "### Contoh",
    "",
    "Matriks berukuran dua kali dua.",
  ],
  "\n"
);

describe("section drafts", () => {
  it("lists the sections of a document in reading order", () => {
    const drafts = documentSections(source, "Matriks", markdown);
    expect(
      Arr.map(drafts, ({ anchor, count, headingPath, ordinal }) => ({
        anchor,
        count,
        headingPath,
        ordinal,
      }))
    ).toEqual([
      { anchor: "top", count: 3, headingPath: [], ordinal: 0 },
      {
        anchor: "bentuk-matriks",
        count: 3,
        headingPath: ["Bentuk Matriks"],
        ordinal: 1,
      },
      {
        anchor: "contoh",
        count: 3,
        headingPath: ["Bentuk Matriks", "Contoh"],
        ordinal: 2,
      },
    ]);
    expect(drafts[0]).toMatchObject(source);
  });

  it("finds a section by its title, its headings, and its body", () => {
    const [, section, example] = documentSections(source, "Matriks", markdown);
    expect(section?.text).toBe(
      "Matriks\nBentuk Matriks\nSebuah matriks ditulis dengan tanda kurung."
    );
    expect(example?.text).toBe(
      "Matriks\nBentuk Matriks > Contoh\nMatriks berukuran dua kali dua."
    );
    expect(section?.excerpt).toBe(
      "Sebuah matriks ditulis dengan tanda kurung."
    );
  });

  it("opens with the title and the introduction, without the title heading twice", () => {
    const [opening] = documentSections(source, "Matriks", markdown);
    expect(opening?.text).toBe(
      "Matriks\nMatriks adalah susunan bilangan dalam baris dan kolom."
    );
  });

  it("gives a heading with no text no section but keeps the places of the others", () => {
    const drafts = documentSections(
      source,
      "Matriks",
      "# Matriks\n\nIntro.\n\n## Kosong\n\n### Isi\n\nAda isi."
    );
    expect(
      Arr.map(drafts, ({ anchor, count, ordinal }) => [anchor, ordinal, count])
    ).toEqual([
      ["top", 0, 3],
      ["isi", 2, 3],
    ]);
  });

  it("keeps a bounded text for a very long section", () => {
    const [opening] = documentSections(
      source,
      "Matriks",
      `# Matriks\n\n${"kata ".repeat(SECTION_TEXT_CHARS)}`
    );
    expect(opening?.text.length).toBeLessThanOrEqual(SECTION_TEXT_CHARS);
    expect(opening?.excerpt.length).toBeLessThan(300);
  });

  it("sends only the start of a text to the embedder", () => {
    expect(embedInput("pendek")).toBe("pendek");
    expect(embedInput("a".repeat(EMBED_TEXT_CHARS + 50))).toHaveLength(
      EMBED_TEXT_CHARS
    );
  });
});
