import { afterEach, describe, expect, it } from "@effect/vitest";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import {
  HISTORY_TURNS,
  nextSummaryTarget,
} from "@repo/backend/confect/nina/fold";
import { sentTurn } from "@repo/backend/confect/nina/history";
import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { provider } from "@repo/backend/test/gateway";
import {
  createSummaryTest,
  summaryModel,
} from "@repo/backend/test/nina/summary";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Option } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
  provider.languageModel.mockReset();
});

/** Turns of the orders `from` to `to`, each costing `tokens`, oldest first. */
function costs(from: number, to: number, tokens: number) {
  return Arr.map(Arr.range(from, to), (order) => ({ order, tokens }));
}

/** Every list of `length` costs that can be drawn from `options`. */
function arrangements(
  options: readonly number[],
  length: number
): readonly (readonly number[])[] {
  return length === 0
    ? [[]]
    : Arr.flatMap(arrangements(options, length - 1), (head) =>
        Arr.map(options, (cost) => Arr.append(head, cost))
      );
}

function sum(list: readonly number[]) {
  return Arr.reduce(list, 0, (total, cost) => total + cost);
}

describe("Nina summary fold", () => {
  // The fold takes the budget as an argument, so these numbers stay small.
  const budget = 100;
  // A read that listed every turn the summary does not cover.
  const nothing = Option.none<number>();

  /**
   * Whether the fold of turns with these costs, oldest first, does what it
   * promises: nothing while they fit or only the newest is left, else a target
   * that leaves the newest, leaves at most half the budget (or the newest alone),
   * and takes no turn more than that needs.
   */
  function holds(list: readonly number[]) {
    const turns = Arr.map(list, (tokens, order) => ({ order, tokens }));
    const target = nextSummaryTarget(null, turns, budget, nothing);
    const newest = list.length - 1;
    // What the turns after the order `through` cost.
    const kept = (through: number) => sum(Arr.drop(list, through + 1));
    if (sum(list) <= budget || list.length === 1) {
      return Option.isNone(target);
    }
    return Option.exists(
      target,
      (through) =>
        through < newest &&
        (kept(through) <= budget / 2 || through === newest - 1) &&
        (through === 0 || kept(through - 1) > budget / 2)
    );
  }

  it("leaves turns that fit alone, at the budget and below it", () => {
    expect(nextSummaryTarget(null, [], budget, nothing)).toEqual(Option.none());
    expect(nextSummaryTarget(null, costs(0, 9, 10), budget, nothing)).toEqual(
      Option.none()
    );
    expect(nextSummaryTarget(null, costs(0, 19, 1), budget, nothing)).toEqual(
      Option.none()
    );
  });

  it("folds the oldest turns once they cost more than the budget, until the rest costs at most half of it", () => {
    // Eleven turns of 10 cost 110. The newest five cost 50, half the budget.
    expect(nextSummaryTarget(null, costs(0, 10, 10), budget, nothing)).toEqual(
      Option.some(5)
    );
    // One more turn folds one more.
    expect(nextSummaryTarget(null, costs(0, 11, 10), budget, nothing)).toEqual(
      Option.some(6)
    );
  });

  it("keeps the newest turn, whatever it costs", () => {
    expect(
      nextSummaryTarget(null, [{ order: 4, tokens: 150 }], budget, nothing)
    ).toEqual(Option.none());
    expect(
      nextSummaryTarget(
        null,
        [
          { order: 3, tokens: 30 },
          { order: 4, tokens: 150 },
        ],
        budget,
        nothing
      )
    ).toEqual(Option.some(3));
  });

  it("keeps the newest turn that costs at most half the budget, and folds the older", () => {
    expect(
      nextSummaryTarget(
        null,
        [
          { order: 0, tokens: 70 },
          { order: 1, tokens: 40 },
        ],
        budget,
        nothing
      )
    ).toEqual(Option.some(0));
  });

  it("folds at most one batch after what the summary covers", () => {
    // Forty turns of 10 cost 400, and the rest fits half the budget after 35 of them.
    const turns = costs(0, 39, 10);
    expect(nextSummaryTarget(null, turns, budget, nothing)).toEqual(
      Option.some(SUMMARY_FOLD_LIMIT - 1)
    );
    expect(nextSummaryTarget(15, turns, budget, nothing)).toEqual(
      Option.some(15 + SUMMARY_FOLD_LIMIT)
    );
  });

  it("decides the same from the newest turns alone once they outweigh the budget", () => {
    const all = costs(0, 55, 30);
    const newest = Arr.drop(all, 40);
    expect(nextSummaryTarget(15, newest, budget, nothing)).toEqual(
      nextSummaryTarget(15, all, budget, nothing)
    );
    expect(nextSummaryTarget(15, all, budget, nothing)).toEqual(
      Option.some(15 + SUMMARY_FOLD_LIMIT)
    );
  });

  it("folds the turns a read gave up on, one batch at a time, though the turns it read fit", () => {
    // Turns 40 to 45 fit, and the read could not get past the askings behind them.
    const newest = costs(40, 45, 10);
    expect(nextSummaryTarget(null, newest, budget, Option.some(39))).toEqual(
      Option.some(SUMMARY_FOLD_LIMIT - 1)
    );
    expect(nextSummaryTarget(30, newest, budget, Option.some(39))).toEqual(
      Option.some(39)
    );
  });

  it("folds a whole batch once the read holds the most turns the history takes, so the next fold waits for a batch of new turns", () => {
    // Seventy turns of one token fit any budget. The read stopped at the newest sixty-four.
    const first = costs(6, 5 + HISTORY_TURNS, 1);
    expect(nextSummaryTarget(null, first, budget, Option.some(5))).toEqual(
      Option.some(SUMMARY_FOLD_LIMIT - 1)
    );
    // After that fold, sixty-four uncovered turns wait and none is left out.
    expect(
      nextSummaryTarget(15, costs(16, 15 + HISTORY_TURNS, 1), budget, nothing)
    ).toEqual(Option.none());
    // One more turn leaves one out again, and the fold takes the next batch.
    expect(
      nextSummaryTarget(
        15,
        costs(17, 16 + HISTORY_TURNS, 1),
        budget,
        Option.some(16)
      )
    ).toEqual(Option.some(15 + SUMMARY_FOLD_LIMIT));
  });

  it("folds the turns a read gave up on when it read only one turn, which alone outweighs the budget", () => {
    expect(
      nextSummaryTarget(
        null,
        [{ order: 50, tokens: 150 }],
        budget,
        Option.some(34)
      )
    ).toEqual(Option.some(SUMMARY_FOLD_LIMIT - 1));
  });

  it("leaves the turns a read gave up on to the size rule when the turns it read outweigh the budget", () => {
    expect(
      nextSummaryTarget(null, costs(0, 10, 10), budget, Option.some(0))
    ).toEqual(Option.some(5));
  });

  it("holds for every arrangement of costs: the newest stays, the rest fits half the budget, and no fold takes more than it must", () => {
    // Costs below, at and above half the budget, in every order of one to four turns.
    const failures = Arr.flatMap(Arr.range(1, 4), (length) =>
      Arr.filter(
        arrangements([10, 30, 60, 120], length),
        (list) => !holds(list)
      )
    );
    expect(failures).toEqual([]);
  });
});

describe("Nina fold by size", () => {
  it("makes no model call while the turns fit, and the model input holds all of them word for word", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    const f = await createSummaryTest(21);
    await f.refresh(19);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
    // Twenty turns are more than the sixteen one fold covers.
    const shown = encodeJsonText(await f.input(20));
    for (const order of Arr.range(0, 19)) {
      expect(shown).toContain(`"Question ${order}"`);
      expect(shown).toContain(`"Answer ${order}"`);
    }
  }, 15_000);

  it.each([
    ["all three alike", [13_000, 13_000, 13_000]],
    ["the largest first", [20_000, 8000, 15_000]],
    ["the largest in the middle", [8000, 20_000, 15_000]],
    ["the largest last", [8000, 14_000, 20_000]],
  ] as const)(
    "summarizes the oldest of three large turns and loses none, whichever of them is largest: %s",
    async (_arrangement, sizes) => {
      const model = summaryModel("- The learner studied limits.");
      provider.languageModel.mockReturnValue(model);
      // The three turns cost more than the budget of 32,000, and none of two does.
      // A fourth turn holds the question that is asked next.
      const f = await createSummaryTest(4, (order) => ({
        tokens: Option.getOrElse(Arr.get(sizes, order), () => 0),
      }));
      for (const settled of Arr.range(0, 2)) {
        await f.refresh(settled);
        expect(await f.lost(settled)).toEqual([]);
      }
      expect(await f.summary()).toEqual([
        expect.objectContaining({
          chatId: f.chatId,
          text: expect.any(ArrayBuffer),
          throughOrder: 1,
          // The fold's provider usage counts toward the chat's summary upkeep.
          usage: { calls: 1, input: 12, output: 4 },
        }),
      ]);
      expect(await f.text()).toBe("- The learner studied limits.");
      const prompt = encodeJsonText(model.doGenerateCalls[0]?.prompt);
      expect(prompt).toContain("None yet.");
      expect(prompt).toContain("Learner: Question 0");
      expect(prompt).toContain("Nina: Answer 1");
      expect(prompt).not.toContain("Question 2");
      // The newest turn stays, and it costs at most half the budget unless it is the only one that stays.
      const stays = Arr.dropRight(await f.input(3), 2);
      expect(
        Arr.filter(stays, ({ role }) => role === "user").length === 1 ||
          sentTurn(stays).tokens <= NINA_BUDGET.history / 2
      ).toBe(true);
      expect(encodeJsonText(stays)).toContain('"Question 2"');
    }
  );

  it("grows the history only at its end between two folds, and moves its start only when a fold covers its oldest turns", async () => {
    const model = summaryModel("- A study session.");
    provider.languageModel.mockReturnValue(model);
    // Seven turns of 5,000 tokens cost 35,000, so a fold comes every four turns or so.
    const f = await createSummaryTest(14, () => ({ tokens: 5000 }));
    let before = Arr.dropRight(await f.input(1), 2);
    let covered = -1;
    let folds = 0;
    let growths = 0;
    for (const settled of Arr.range(1, 12)) {
      await f.refresh(settled);
      const through = (await f.stored())?.throughOrder ?? -1;
      const history = Arr.dropRight(await f.input(settled + 1), 2);
      if (through === covered) {
        expect(Arr.take(history, before.length)).toEqual(before);
        expect(history.length).toBeGreaterThan(before.length);
        growths += 1;
      } else {
        // The fold took the oldest turns out of the history, and the rest stays.
        expect(encodeJsonText(history)).not.toContain(`"Question ${through}"`);
        expect(encodeJsonText(history)).toContain(`"Question ${through + 1}"`);
        folds += 1;
      }
      covered = through;
      before = history;
    }
    expect(folds).toBe(2);
    expect(growths).toBe(10);
    expect(model.doGenerateCalls).toHaveLength(2);
  }, 30_000);

  it("folds one batch once a chat of short turns holds more turns than the history takes, and then waits for a batch of new turns", async () => {
    const model = summaryModel("- The first sixteen turns.");
    provider.languageModel.mockReturnValue(model);
    const f = await createSummaryTest(HISTORY_TURNS + 3);
    // Sixty-four short turns fit the budget and the count, so nothing folds.
    await f.refresh(HISTORY_TURNS - 1);
    expect(provider.languageModel).not.toHaveBeenCalled();
    // The sixty-fifth is one too many: the fold covers the oldest batch.
    await f.refresh(HISTORY_TURNS);
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: SUMMARY_FOLD_LIMIT - 1 }),
    ]);
    const shown = encodeJsonText(await f.input(HISTORY_TURNS + 1));
    expect(shown).not.toContain(`"Question ${SUMMARY_FOLD_LIMIT - 1}"`);
    expect(shown).toContain(`"Question ${SUMMARY_FOLD_LIMIT}"`);
    // The next turn leaves forty-nine uncovered, so no second fold follows.
    await f.refresh(HISTORY_TURNS + 1);
    expect(model.doGenerateCalls).toHaveLength(1);
  }, 60_000);

  it("takes the asking that a retry replaces out of the history, wherever it is, without a fold", async () => {
    provider.languageModel.mockReturnValue(summaryModel("unused"));
    // Order 3 asks the question of order 0 again.
    const f = await createSummaryTest(5, (order) =>
      order === 3 ? { retryOf: 0 } : {}
    );
    const before = Arr.dropRight(await f.input(3), 2);
    await f.refresh(3);
    const after = Arr.dropRight(await f.input(4), 2);
    expect(encodeJsonText(before[0])).toContain("Question 0");
    // The start of the history moved with no fold, and the retry came in at its end.
    expect(encodeJsonText(after[0])).toContain("Question 1");
    expect(after).toHaveLength(before.length);
    expect(await f.summary()).toEqual([]);
    expect(provider.languageModel).not.toHaveBeenCalled();
  });

  it("leaves no turn in neither the summary nor the history, after any turn settles", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- A study session."));
    // Each turn costs about 9,000 tokens: a fold comes every four or so.
    const f = await createSummaryTest(14, () => ({ tokens: 9000 }));
    for (const settled of Arr.range(0, 12)) {
      await f.refresh(settled);
      expect(await f.lost(settled)).toEqual([]);
    }
    // The summary folded more than once, and the history never outgrew the budget.
    expect((await f.stored())?.throughOrder).toBeGreaterThan(2);
    // The turn being answered is the last two messages, its question and answer.
    const history = Arr.dropRight(await f.input(13), 2);
    expect(sentTurn(history).tokens).toBeLessThanOrEqual(NINA_BUDGET.history);
  }, 30_000);

  it("does not fold a turn larger than the whole budget while it is the newest, and folds it once another turn follows", async () => {
    provider.languageModel.mockReturnValue(summaryModel("- One long answer."));
    const f = await createSummaryTest(2, (order) =>
      order === 0 ? { tokens: NINA_BUDGET.history + 8000 } : {}
    );
    await f.refresh(0);
    expect(provider.languageModel).not.toHaveBeenCalled();
    expect(await f.summary()).toEqual([]);
    await f.refresh(1);
    expect(await f.summary()).toEqual([
      expect.objectContaining({ throughOrder: 0 }),
    ]);
  });
});
