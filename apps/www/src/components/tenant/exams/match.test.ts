import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { matchAnswers, textLabel } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";
import { emptyLabel } from "@/components/tenant/exams/answer";
import {
  keyPairs,
  keyWithoutPart,
  matchOf,
  pairsKey,
  withPartAdded,
  withPartLabel,
  withPartRemoved,
} from "@/components/tenant/exams/match";

/** A new matching question's answers: three statements and three answers. */
const answers = matchAnswers();
const [match] = answers;

/** A text entry, which is not a match, so a match edit leaves it as it is. */
const entry: Interaction = { id: "entry", kind: "textEntry", label: "Entry" };

/** The pairs that pair every statement of the new match. */
const full = [
  { source: "source-1", target: "target-2" },
  { source: "source-2", target: "target-3" },
  { source: "source-3", target: "target-1" },
];

describe("matchOf and withPartLabel", () => {
  it("finds the match of the answers, and none in a text entry", () => {
    expect(matchOf(answers)).toEqual(Option.some(match));
    expect(matchOf([entry])).toEqual(Option.none());
  });

  it("writes the label of a statement or an answer, and leaves the rest and other interactions", () => {
    const [labelled, other] = withPartLabel(
      withPartLabel([match, entry], "source-2", textLabel("Ibu kota")),
      "target-1",
      textLabel("Jakarta")
    );
    expect(other).toEqual(entry);
    expect(labelled).toMatchObject({
      sources: [
        { id: "source-1", label: emptyLabel() },
        { id: "source-2", label: textLabel("Ibu kota") },
        { id: "source-3" },
      ],
      targets: [
        { id: "target-1", label: textLabel("Jakarta") },
        { id: "target-2" },
        { id: "target-3" },
      ],
    });
  });
});

describe("withPartAdded and withPartRemoved", () => {
  it("adds an empty statement or answer numbered after the largest, up to five on a side", () => {
    const [added] = withPartAdded(answers, "targets");
    expect(added).toMatchObject({
      targets: [
        { id: "target-1" },
        { id: "target-2" },
        { id: "target-3" },
        { id: "target-4", label: emptyLabel(), maxMatches: 1 },
      ],
    });
    const five = withPartAdded(withPartAdded(answers, "sources"), "sources");
    expect(withPartAdded(five, "sources")).toEqual(five);
  });

  it("numbers a new part from one when no part ID holds a number", () => {
    const named = [
      {
        ...match,
        sources: [
          { id: "first", label: emptyLabel(), maxMatches: 1 },
          { id: "second", label: emptyLabel(), maxMatches: 1 },
        ],
      },
    ] as const;
    const [added] = withPartAdded(named, "sources");
    expect(
      Arr.map(added.kind === "match" ? added.sources : [], (part) => part.id)
    ).toEqual(["first", "second", "source-1"]);
  });

  it("removes a part down to two on its side, and leaves other interactions", () => {
    const [removed] = withPartRemoved(answers, "source-2");
    expect(removed).toMatchObject({
      sources: [{ id: "source-1" }, { id: "source-3" }],
    });
    const two = withPartRemoved(answers, "target-3");
    expect(withPartRemoved(two, "target-2")).toEqual(two);
    expect(withPartRemoved([entry], "source-1")).toEqual([entry]);
  });

  it("leaves a side as it is when the removal would empty it, as parts sharing one ID would", () => {
    const part = { id: "source-1", label: emptyLabel(), maxMatches: 1 };
    const twins: Interaction = { ...match, sources: [part, part, part] };
    expect(withPartRemoved([twins], "source-1")).toEqual([twins]);
  });
});

describe("pairsKey and keyWithoutPart", () => {
  it("keys a match only once every statement is paired, and reads its pairs back", () => {
    expect(pairsKey(answers, Arr.take(full, 2))).toBeNull();
    const key = pairsKey(answers, full);
    expect(key).toEqual([{ interaction: "match", kind: "match", pairs: full }]);
    expect(keyPairs(key)).toEqual(full);
    expect(keyPairs(null)).toEqual([]);
    expect(pairsKey([entry], full)).toBeNull();
  });

  it("keeps the key when a removed statement leaves the rest paired, and clears it when an answer leaves", () => {
    const key = pairsKey(answers, full);
    const fewer = withPartRemoved(answers, "source-3");
    expect(keyWithoutPart(fewer, key, "source-3")).toEqual([
      { interaction: "match", kind: "match", pairs: Arr.take(full, 2) },
    ]);
    expect(
      keyWithoutPart(withPartRemoved(answers, "target-2"), key, "target-2")
    ).toBeNull();
  });
});
