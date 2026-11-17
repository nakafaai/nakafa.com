import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, String as Str } from "effect";
import { inspectMarkers, TEXT_FILE_PATTERN } from "#scripts/check/markers";

/** A marker line of seven of one sign and its label, built here so this file holds none. */
const marker = (sign: string, label = "") =>
  `${Str.repeat(7)(sign)}${label === "" ? "" : ` ${label}`}`;

/** A text of these lines. */
const text = (lines: readonly string[]) => Arr.join(lines, "\n");

describe("inspectMarkers", () => {
  it("reports every marker line a conflict left, by its line number", () => {
    const left = text([
      "# Notes",
      marker("<", "HEAD"),
      "ours",
      marker("|", "parent of 1234567 (Add notes)"),
      "base",
      marker("="),
      "theirs",
      marker(">", "1234567 (Add notes)"),
    ]);
    expect(inspectMarkers("docs/notes.md", left)).toEqual(
      Arr.map(
        [2, 4, 6, 8],
        (line) =>
          `docs/notes.md:${line}: resolve the merge conflict this line marks: keep what both sides meant and delete Git's marker lines.`
      )
    );
  });

  it("reports a lone ancestor or closing marker that a resolution forgot, and reads Windows line ends", () => {
    expect(
      inspectMarkers(
        "a.md",
        text(["kept", marker("|", "parent of abc"), "kept"])
      )
    ).toHaveLength(1);
    expect(
      inspectMarkers("a.ts", `${marker(">", "theirs")}\r\nconst a = 1;\r\n`)
    ).toHaveLength(1);
  });

  it("keeps a Markdown heading underlined with `=`, and lines that only start like a marker", () => {
    const clean = text([
      "Title",
      marker("="),
      "",
      "Longer title",
      Str.repeat(12)("="),
      `${Str.repeat(7)("<")}no space`,
      `  ${marker(">", "indented")}`,
      `${Str.repeat(8)("|")} eight`,
    ]);
    expect(inspectMarkers("README.md", clean)).toEqual([]);
  });

  it("reads sources, styles, data, configuration and documents, never images", () => {
    Arr.forEach(
      [
        "a.ts",
        "b.tsx",
        "c.mjs",
        "d.json",
        "e.md",
        "f.mdx",
        "g.css",
        "h.yml",
        "i.toml",
        "j.svg",
      ],
      (file) => expect(TEXT_FILE_PATTERN.test(file)).toBe(true)
    );
    Arr.forEach(["a.png", "b.webp", "c.woff2", "d.lockb"], (file) =>
      expect(TEXT_FILE_PATTERN.test(file)).toBe(false)
    );
  });
});
