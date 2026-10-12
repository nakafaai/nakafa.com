import { expect, it } from "@effect/vitest";
import { settleOutcome } from "@repo/backend/confect/nina/capability/outcome";
import {
  done,
  loading,
  lost,
  verified,
} from "@repo/backend/test/nina/artifact";

it.each([
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
] as const)(
  "settles the stored outcome: %s",
  (_name, cards, reported, stored) => {
    expect(settleOutcome(reported, cards, false)).toBe(stored);
  }
);

it.each([
  [
    "a run with no card and no stated outcome found nothing",
    undefined,
    false,
    "empty",
  ],
  [
    "a text-only run with no card is not empty: its answer is the text",
    undefined,
    true,
    undefined,
  ],
  ["a stated outcome is kept when there is no card", "failed", false, "failed"],
  [
    "a stated outcome is kept when a text-only run has no card",
    "limit",
    true,
    "limit",
  ],
] as const)(
  "settles a run with no card: %s",
  (_name, reported, textOnly, stored) => {
    expect(settleOutcome(reported, [], textOnly)).toBe(stored);
  }
);

it("keeps a card that is still loading from making a run empty", () => {
  expect(settleOutcome(undefined, [loading], false)).toBeUndefined();
});
