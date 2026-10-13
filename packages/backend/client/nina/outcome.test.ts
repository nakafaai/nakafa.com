import { expect, it } from "@effect/vitest";
import { readOutcome, settleOutcome } from "@repo/backend/client/nina/outcome";
import {
  MEMORY_CAPABILITY,
  NAKAFA_CAPABILITY,
} from "@repo/backend/confect/nina/capability/spec";
import {
  done,
  loading,
  lost,
  verified,
} from "@repo/backend/test/nina/artifact";

const settledWithCards = [
  [
    "a failed run that loaded nothing stays failed",
    [loading],
    "failed",
    "failed",
  ],
  [
    "a failed run never contradicts loaded sources",
    [done],
    "failed",
    "partial",
  ],
  [
    "a failed run never contradicts a verified calculation",
    [verified],
    "failed",
    "partial",
  ],
  [
    "a run that lost a card beside a loaded one is partial",
    [done, lost],
    undefined,
    "partial",
  ],
  [
    "a run that lost a card beside a verified calculation is partial",
    [verified, lost],
    undefined,
    "partial",
  ],
  [
    "a run that only lost cards is failed, whatever prose it returned",
    [lost],
    undefined,
    "failed",
  ],
  [
    "a run with every card loaded reports no outcome",
    [done, verified],
    undefined,
    undefined,
  ],
  [
    "an empty run that lost a card beside a settled one is partial",
    [done, lost],
    "empty",
    "partial",
  ],
  ["an empty run stays empty beside settled cards", [done], "empty", "empty"],
  [
    "a denied run stays denied whatever its cards",
    [done, lost],
    "denied",
    "denied",
  ],
  ["a stated outcome survives lost evidence", [lost], "empty", "empty"],
] as const;

it.each(settledWithCards)(
  "settles the stored outcome: %s",
  (_name, cards, reported, stored) => {
    expect(settleOutcome(reported, cards, NAKAFA_CAPABILITY)).toBe(stored);
  }
);

it.each(settledWithCards)(
  "reads a result the runner stored as the outcome it stored: %s",
  (_name, cards, _reported, stored) => {
    // The runner stores the settled outcome, or none when it settled none.
    const result = {
      artifacts: cards,
      ...(stored ? { outcome: stored } : {}),
    };
    expect(readOutcome(result, NAKAFA_CAPABILITY)).toBe(stored ?? "done");
  }
);

it.each([
  [
    "a run with no card and no stated outcome found nothing",
    undefined,
    NAKAFA_CAPABILITY,
    "empty",
  ],
  [
    "a text-only run with no card is not empty: its answer is the text",
    undefined,
    MEMORY_CAPABILITY,
    undefined,
  ],
  [
    "a stated outcome is kept when there is no card",
    "failed",
    NAKAFA_CAPABILITY,
    "failed",
  ],
  [
    "a stated outcome is kept when a text-only run has no card",
    "limit",
    MEMORY_CAPABILITY,
    "limit",
  ],
] as const)(
  "settles a run with no card: %s",
  (_name, reported, capability, stored) => {
    expect(settleOutcome(reported, [], capability)).toBe(stored);
  }
);

it("keeps a card that is still loading from making a run empty", () => {
  expect(
    settleOutcome(undefined, [loading], NAKAFA_CAPABILITY)
  ).toBeUndefined();
});

it("reads a stored result that holds evidence and no outcome as done", () => {
  expect(readOutcome({ artifacts: [done] }, NAKAFA_CAPABILITY)).toBe("done");
});

it.each([
  ["with prose", "I could not find a lesson about it."],
  ["without prose", ""],
])(
  "reads a stored result with no card and no outcome as the runner would store a fresh one, %s",
  (_name, text) => {
    const stored = { artifacts: [], text };

    expect(readOutcome(stored, NAKAFA_CAPABILITY)).toBe("empty");
  }
);

it("reads a stored result of a text-only capability with no card and no outcome as done", () => {
  expect(readOutcome({ artifacts: [] }, MEMORY_CAPABILITY)).toBe("done");
});

it("reads a stored result that lost evidence and states no outcome as the runner would settle it", () => {
  expect(readOutcome({ artifacts: [done, lost] }, NAKAFA_CAPABILITY)).toBe(
    "partial"
  );
  expect(readOutcome({ artifacts: [lost] }, NAKAFA_CAPABILITY)).toBe("failed");
});
