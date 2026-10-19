import { describe, expect, it } from "@effect/vitest";
import { documentSections } from "@repo/backend/confect/contents/sections/draft";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { formatRead } from "@repo/backend/confect/nina/nakafa/sections";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Array as Arr } from "effect";

const MORE_SECTIONS = /- \d+ more sections$/;
const FOLLOWING_SECTION = /\(section: ([^)]+)\)/;
const DIGITS = /^\d+$/;
const SUMMARY_PART = /\n\n(?:Kalimat|tanpa|jeda) /;
const subjectRoute =
  "material/lesson/mathematics/example-topic/example-section";

describe("Nakafa sectioned reads", () => {
  it("formats full content reads", () => {
    const text = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      description: "Pelajari contoh.",
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
    });

    expect(text).toContain("# Nakafa Content");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain(`https://nakafa.com/id/${subjectRoute}`);
    expect(text).not.toContain("Markdown URL:");
    expect(text).toContain("Isi materi lengkap.");
  });

  it("omits an unavailable content description", () => {
    const text = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
    });

    expect(text).toContain("- Title: Contoh Materi");
    expect(text).not.toContain("- Description:");
  });

  it("reads long content in budgeted sections and lists the rest", () => {
    // Each repetition costs 7 estimated tokens, so the 427 repetitions cost
    // 2,989. The heading "## Definisi" costs 3 more, so one lesson with its
    // heading costs 2,992. A part holds half the budget, 3,000, so one lesson is
    // one part. Two lessons, 5,984 tokens together, do not fit a read's body
    // beside its header and outline.
    const lesson = (heading: string) =>
      `## ${heading}\n\n${"Fungsi memetakan setiap anggota domain. ".repeat(427)}`;
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: Arr.join(
        [
          "Pengantar singkat.",
          lesson("Definisi"),
          lesson("Contoh"),
          lesson("Contoh"),
        ],
        "\n\n"
      ),
      title: "Fungsi",
    };
    const first = formatRead(content);
    expect(countTextTokens(first)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(first).toContain("Pengantar singkat.");
    expect(first).toContain("## Other Sections");
    expect(first).toContain("- Contoh (section: contoh)");
    expect(first).toContain("- Contoh (section: contoh-2)");

    const later = formatRead(content, { section: "contoh-2" });
    expect(later).toContain("## Contoh");
    expect(later).not.toContain("Pengantar singkat.");
    expect(later).toContain("- Start (section: top)");

    const missing = formatRead(content, { section: "latihan" });
    expect(missing).toContain("Section latihan was not found in this content.");
    expect(missing).toContain("- Definisi (section: definisi)");
  });

  it("caps the outline for content with many sections", () => {
    const text = Arr.join(
      Array.from(
        { length: 40 },
        (_, index) =>
          `### Verse ${index + 1}\n\n${"Ayat panjang dengan tafsir. ".repeat(120)}`
      ),
      "\n\n"
    );
    const read = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text,
      title: "Surah",
    });
    expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(read).toMatch(MORE_SECTIONS);
  });

  it("continues inside a section longer than one read without losing a line", () => {
    const step = "Langkah bukti yang panjang.";
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: Arr.join(
        [
          `## Bukti\n\n${`${step}\n`.repeat(1500)}`,
          `## Ringkasan\n\n${"Kalimat tanpa jeda ".repeat(3000)}`,
        ],
        "\n\n"
      ),
      title: "Bukti",
    };
    const next = (read: string) => FOLLOWING_SECTION.exec(read)?.[1];
    const steps = (read: string) => read.split(step).length - 1;
    let read = formatRead(content);
    let seen = steps(read);
    let continued: string[] = [];
    for (let slug = next(read); slug?.startsWith("bukti:"); slug = next(read)) {
      continued = Arr.append(continued, slug);
      read = formatRead(content, { section: slug });
      expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
      expect(read).not.toContain("## Bukti");
      seen += steps(read);
    }
    expect(continued.length).toBeGreaterThan(0);
    expect(seen).toBe(1500);
    const summary = formatRead(content, { section: "ringkasan:part-2" });
    expect(countTextTokens(summary)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(summary).toMatch(SUMMARY_PART);
    expect(summary).toContain("- Bukti (section: bukti)");
  });

  it("splits an unbroken line by characters without losing any", () => {
    const blob = "0123456789".repeat(2000);
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: `## Data\n\n${blob}`,
      title: "Data",
    };
    const body = (read: string) =>
      Arr.filter(read.split("\n\n"), (block) => DIGITS.test(block));
    let read = formatRead(content);
    let blocks = body(read);
    for (let slug = FOLLOWING_SECTION.exec(read)?.[1]; slug; ) {
      read = formatRead(content, { section: slug });
      expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
      blocks = Arr.appendAll(blocks, body(read));
      const following = FOLLOWING_SECTION.exec(read)?.[1];
      slug = following === "data" ? undefined : following;
    }
    expect(blocks.length).toBeGreaterThan(1);
    expect(Arr.join(blocks, "")).toBe(blob);
  });

  it("stays within its budget when the description leaves no room", () => {
    const read = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      description: "Deskripsi yang sangat panjang. ".repeat(2000),
      text: `## Definisi\n\n${"Fungsi memetakan anggota domain. ".repeat(400)}`,
      title: "Fungsi",
    });
    expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(read).toContain("Request one of the listed sections.");
  });

  it("opens every section that the section index lists, by the anchor it lists", () => {
    const markdown = Arr.join(
      [
        "# Matriks",
        "Pengantar singkat.",
        "## Contoh",
        "Contoh pertama.",
        "### Langkah",
        "Langkah pertama.",
        "## Contoh",
        "Contoh kedua.",
      ],
      "\n\n"
    );
    const sections = documentSections(
      {
        appLocale: "id",
        contentKey: "material/lesson/matematika/matriks",
        publicPath: "materi/matematika/matriks",
        section: "material",
      },
      "Matriks",
      markdown
    );
    expect(Arr.map(sections, ({ anchor }) => anchor)).toEqual([
      "top",
      "contoh",
      "langkah",
      "contoh-2",
    ]);
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: markdown,
      title: "Matriks",
    };
    for (const { anchor, excerpt } of sections) {
      const read = formatRead(content, { section: anchor });
      expect(read).not.toContain("was not found in this content");
      expect(read).toContain(excerpt);
    }
  });

  it("opens a surah at the verse that a Quran passage of the section index starts with", () => {
    // The index names a passage by the section of its first verse, `verse-7`
    // for the passage of the verses 7 to 12.
    const text = Arr.join(
      [
        "# Al-Baqarah",
        "## Verses",
        ...Arr.flatMap(Arr.range(1, 12), (verse) => [
          `### Verse ${verse}`,
          `Ayat nomor ${verse}.`,
        ]),
      ],
      "\n\n"
    );
    const read = formatRead(
      {
        ...readNakafaContentRefFixture("id", "quran/2", "quran"),
        text,
        title: "Al-Baqarah",
      },
      { section: "verse-7" }
    );
    expect(read).not.toContain("was not found in this content");
    expect(read).toContain("Ayat nomor 7.");
    expect(read).toContain("Ayat nomor 12.");
    expect(read).not.toContain("Ayat nomor 6.");
  });

  it("lists the sections after a later read first in a capped outline", () => {
    const text = Arr.join(
      Array.from(
        { length: 40 },
        (_, index) =>
          `### Verse ${index + 1}\n\n${"Ayat panjang dengan tafsir. ".repeat(120)}`
      ),
      "\n\n"
    );
    const read = formatRead(
      {
        ...readNakafaContentRefFixture("id", subjectRoute, "material"),
        text,
        title: "Surah",
      },
      { section: "verse-30" }
    );
    const outline = read.slice(read.indexOf("## Other Sections"));
    expect(outline).toContain("(section: verse-40)");
    expect(outline.indexOf("(section: verse-40)")).toBeLessThan(
      outline.indexOf("(section: verse-1)")
    );
  });
});
