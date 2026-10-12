import { describe, expect, it } from "@effect/vitest";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";
import { Array as Arr } from "effect";

/**
 * The same research task in four languages: the queries the model wrote for it
 * and a task text in the learner's own script.
 */
const tasks = [
  {
    language: "English",
    task: "Which changes did Next.js 16 bring to Cache Components?",
    first: "Next.js 16 Cache Components changes",
    more: [
      "nextjs.org blog next-16",
      "Cache Components migration guide",
      "Next.js 16 release notes",
    ],
  },
  {
    language: "Japanese",
    task: "Next.js 16のCache Componentsで何が変わったのか教えてください",
    first: "Next.js 16 Cache Components 変更点",
    more: [
      "nextjs.org blog next-16",
      "Cache Components 移行ガイド",
      "Next.js 16 リリースノート",
    ],
  },
  {
    language: "Arabic",
    task: "ما الذي تغير في Cache Components مع Next.js 16؟",
    first: "Next.js 16 Cache Components التغييرات",
    more: [
      "nextjs.org blog next-16",
      "Cache Components دليل الترحيل",
      "Next.js 16 ملاحظات الإصدار",
    ],
  },
  {
    language: "Thai",
    task: "Next.js 16 เปลี่ยนแปลงอะไรบ้างใน Cache Components",
    first: "Next.js 16 Cache Components การเปลี่ยนแปลง",
    more: [
      "nextjs.org blog next-16",
      "Cache Components คู่มือการย้าย",
      "Next.js 16 บันทึกการออกรุ่น",
    ],
  },
];

describe("search query planning", () => {
  it.each(tasks)(
    "runs the queries the model wrote in $language as written, in order, without repeats, up to the limit",
    ({ first, more, task }) => {
      expect(
        planSearchQueries({
          task,
          maxQueries: 3,
          queries: [`  ${first}  `, "   ", first.toLocaleUpperCase(), ...more],
        })
      ).toEqual([first, ...Arr.take(more, 2)]);
    }
  );

  it("collapses every run of spaces, tabs and line breaks inside a query", () => {
    expect(
      planSearchQueries({
        task: "",
        maxQueries: 4,
        queries: ["fungsi   kuadrat\tkelas\n10"],
      })
    ).toEqual(["fungsi kuadrat kelas 10"]);
  });

  it("runs a query that holds no capitalized phrase of the task", () => {
    const queries = [
      '"SMA Tirta Lazuardi"',
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
      '"tryout matematika nasional" 28 Mei 2026',
    ];

    expect(
      planSearchQueries({
        task: "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026.",
        maxQueries: 4,
        queries,
      })
    ).toEqual(queries);
  });

  it.each(tasks)(
    "searches the task text without its section labels when the model wrote no usable query ($language)",
    ({ task }) => {
      expect(
        planSearchQueries({
          task: Arr.join(
            [
              "# Request",
              "",
              task,
              "",
              "# Objective",
              "",
              "  Find the official source.  ",
            ],
            "\n"
          ),
          maxQueries: 4,
          queries: ["", "   "],
        })
      ).toEqual([`${task} Find the official source.`]);
    }
  );

  it("cuts the task text to the 500 characters the search provider accepts, never inside one character", () => {
    const plan = (task: string) =>
      planSearchQueries({ task, maxQueries: 4, queries: [] });

    expect(plan("あ".repeat(600))).toEqual(["あ".repeat(500)]);
    expect(plan("😀".repeat(600))).toEqual(["😀".repeat(500)]);
    expect(plan(`${"a".repeat(499)} b`)).toEqual(["a".repeat(499)]);
  });

  it("runs no search when the task holds no text besides its section labels", () => {
    expect(
      Arr.map(["", "   \n  ", "# SNBT", "# Request\n\n# Objective"], (task) =>
        planSearchQueries({ task, maxQueries: 4, queries: [] })
      )
    ).toEqual([[], [], [], []]);
  });
});
