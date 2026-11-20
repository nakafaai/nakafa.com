import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Option } from "effect";
import {
  makePartsWriter,
  nextPartsWrite,
  onlyResponse,
  partOf,
  reviewedParts,
  withPart,
} from "@/components/tryout/runtime/response/parts";

const NUMBER = { text: "2" };
const WORD = { text: "Haus" };

/** The two parts of an exam task: a number, then a word. */
const PARTS: readonly Interaction[] = [
  {
    acceptsFractions: false,
    id: "part-a",
    kind: "numericEntry",
    label: "Antwort a",
  },
  { id: "part-b", kind: "textEntry", label: "Antwort b" },
];

/** The question's stored response once its first part holds a number, at version 3. */
const SHOWN = {
  response: {
    answeredAt: 1,
    response: { parts: [{ interaction: "part-a", response: NUMBER }] },
    updatedAt: 1,
  },
  version: 3,
};

describe("tryout/runtime/response/parts", () => {
  it("sets one part beside the others, replaces it, and clears the question once no part holds an answer", () => {
    const first = withPart(null, "part-a", NUMBER);
    expect(first).toEqual({
      parts: [{ interaction: "part-a", response: NUMBER }],
    });
    expect(withPart(first, "part-b", WORD)).toEqual({
      parts: [
        { interaction: "part-a", response: NUMBER },
        { interaction: "part-b", response: WORD },
      ],
    });
    expect(withPart(first, "part-a", { text: "3" })).toEqual({
      parts: [{ interaction: "part-a", response: { text: "3" } }],
    });
    expect(withPart(first, "part-a", null)).toBeNull();
    // A response to one interaction holds no part to keep.
    expect(withPart(["option-1"], "part-a", NUMBER)).toEqual(first);
  });

  it("reads one part, the response of a question of one interaction, and none for a blank part", () => {
    const response = withPart(null, "part-a", NUMBER);
    expect(partOf(response, "part-a")).toEqual(NUMBER);
    expect(partOf(response, "part-b")).toBeNull();
    expect(partOf(null, "part-a")).toBeNull();
    expect(onlyResponse(["option-1"])).toEqual(["option-1"]);
    expect(onlyResponse(response)).toBeNull();
    expect(onlyResponse(null)).toBeNull();
  });

  it("numbers a part's write above the version the question shows, built on what it holds", () => {
    expect(nextPartsWrite(SHOWN, Option.none(), "part-b", WORD)).toEqual({
      response: {
        parts: [
          { interaction: "part-a", response: NUMBER },
          { interaction: "part-b", response: WORD },
        ],
      },
      version: 4,
    });
    expect(
      nextPartsWrite({ response: null }, Option.none(), "part-a", NUMBER)
    ).toEqual({ response: SHOWN.response.response, version: 1 });
  });

  it("builds on the page's own last write while the question shows an older version, so two parts saved at once both stay", () => {
    const first = nextPartsWrite(SHOWN, Option.none(), "part-b", WORD);
    // The second part saves before the question shows the first write.
    expect(
      nextPartsWrite(SHOWN, Option.some(first), "part-a", { text: "5" })
    ).toEqual({
      response: {
        parts: [
          { interaction: "part-b", response: WORD },
          { interaction: "part-a", response: { text: "5" } },
        ],
      },
      version: 5,
    });
    // Once the question shows a version as new, from this page or another tab, it builds on the question.
    expect(
      nextPartsWrite(
        { ...SHOWN, version: 4 },
        Option.some(first),
        "part-b",
        null
      )
    ).toEqual({ response: SHOWN.response.response, version: 5 });
  });

  it("numbers each write of a page above its last, so a part saved before the question shows the last keeps it", () => {
    const writePart = makePartsWriter();
    expect(writePart(SHOWN, "part-b", WORD)).toMatchObject({ version: 4 });
    expect(writePart(SHOWN, "part-a", { text: "5" })).toEqual({
      response: {
        parts: [
          { interaction: "part-b", response: WORD },
          { interaction: "part-a", response: { text: "5" } },
        ],
      },
      version: 5,
    });
  });

  it("reviews each part in the item's order with its key, its grade and what the learner gave it, when the reader may see them", () => {
    const keys = [
      { interaction: "part-a", kind: "numericEntry", value: "2" },
    ] as const;
    const grade = {
      ceiling: 3,
      parts: [
        {
          grade: { category: 2, ceiling: 2, status: "scored" },
          interaction: "part-a",
        },
        { grade: { ceiling: 1, status: "pending" }, interaction: "part-b" },
      ],
      status: "pending",
    } as const;

    expect(
      reviewedParts({
        grade,
        interactions: PARTS,
        keys,
        response: withPart(null, "part-a", NUMBER),
      })
    ).toEqual([
      {
        grade: Option.some(grade.parts[0].grade),
        interaction: PARTS[0],
        key: Option.some(keys[0]),
        response: NUMBER,
      },
      {
        grade: Option.some(grade.parts[1].grade),
        interaction: PARTS[1],
        key: Option.none(),
        response: null,
      },
    ]);
    expect(
      reviewedParts({
        grade: undefined,
        interactions: PARTS,
        keys: undefined,
        response: null,
      })
    ).toEqual([
      {
        grade: Option.none(),
        interaction: PARTS[0],
        key: Option.none(),
        response: null,
      },
      {
        grade: Option.none(),
        interaction: PARTS[1],
        key: Option.none(),
        response: null,
      },
    ]);
  });
});
