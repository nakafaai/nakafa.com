import { describe, expect, it } from "@effect/vitest";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { formatRead } from "@repo/backend/confect/nina/nakafa/sections";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";

const MORE_SECTIONS = /- \d+ more sections$/;
const NEXT_SECTION = /\(section: ([^)]+)\)/;
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
    const lesson = (heading: string) =>
      `## ${heading}\n\n${"Fungsi memetakan setiap anggota domain. ".repeat(400)}`;
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: [
        "Pengantar singkat.",
        lesson("Definisi"),
        lesson("Contoh"),
        lesson("Contoh"),
      ].join("\n\n"),
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
    const text = Array.from(
      { length: 40 },
      (_, index) =>
        `### Verse ${index + 1}\n\n${"Ayat panjang dengan tafsir. ".repeat(120)}`
    ).join("\n\n");
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
      text: [
        `## Bukti\n\n${`${step}\n`.repeat(1500)}`,
        `## Ringkasan\n\n${"Kalimat tanpa jeda ".repeat(3000)}`,
      ].join("\n\n"),
      title: "Bukti",
    };
    const next = (read: string) => NEXT_SECTION.exec(read)?.[1];
    const steps = (read: string) => read.split(step).length - 1;
    let read = formatRead(content);
    let seen = steps(read);
    const continued: string[] = [];
    for (let slug = next(read); slug?.startsWith("bukti:"); slug = next(read)) {
      continued.push(slug);
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
      read.split("\n\n").filter((block) => DIGITS.test(block));
    let read = formatRead(content);
    const blocks = body(read);
    for (let slug = NEXT_SECTION.exec(read)?.[1]; slug; ) {
      read = formatRead(content, { section: slug });
      expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
      blocks.push(...body(read));
      const following = NEXT_SECTION.exec(read)?.[1];
      slug = following === "data" ? undefined : following;
    }
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.join("")).toBe(blob);
  });

  it("lists the sections after a later read first in a capped outline", () => {
    const text = Array.from(
      { length: 40 },
      (_, index) =>
        `### Verse ${index + 1}\n\n${"Ayat panjang dengan tafsir. ".repeat(120)}`
    ).join("\n\n");
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
