import { describe, expect, it } from "@effect/vitest";
import {
  balance,
  bestThreshold,
  confusion,
  failureLine,
  histogram,
  judgmentTable,
  type Point,
  wrongly,
} from "@repo/backend/scripts/judgment/report";
import { Array as Arr } from "effect";

/** Six messages: two labelled yes that a threshold of one half splits, and four labelled no, one of them private data. */
const points: readonly Point[] = [
  { label: true, languages: "id", probability: 0.95, row: 1 },
  { label: true, languages: "ja", probability: 0.4, row: 2 },
  { form: "phone", label: false, languages: "en", probability: 0.62, row: 3 },
  { label: false, languages: "de", probability: 0.05, row: 4 },
  { label: false, languages: "ar", probability: 0.5, row: 5 },
  { label: true, languages: "zh", probability: 0.5, row: 6 },
];

/** A set that one threshold separates: no probability of a no message reaches a yes message. */
const separable: readonly Point[] = [
  ...Arr.map([0.7, 0.8, 0.9], (probability, index) => ({
    label: true,
    languages: "id",
    probability,
    row: index + 1,
  })),
  ...Arr.map([0.1, 0.2, 0.3], (probability, index) => ({
    label: false,
    languages: "id",
    probability,
    row: index + 4,
  })),
];

describe("judgment report counts", () => {
  it("counts a message as yes from the threshold on, that threshold included", () => {
    expect(confusion(points, 0.5)).toEqual({
      cleared: 1,
      found: 2,
      missed: 1,
      wrong: 2,
    });
    expect(confusion(points, 0.51)).toEqual({
      cleared: 2,
      found: 1,
      missed: 2,
      wrong: 1,
    });
  });

  it("balances the share of yes messages found and the share of no messages cleared, and is nothing without messages", () => {
    // Two of three yes found, one of three no cleared.
    expect(balance(points, 0.5)).toBeCloseTo(0.5);
    expect(balance(separable, 0.5)).toBe(1);
    expect(balance([], 0.5)).toBe(0);
  });

  it("lists the messages a threshold judges wrongly in the order of the set", () => {
    expect(Arr.map(wrongly(points, 0.5), (point) => point.row)).toEqual([
      2, 3, 5,
    ]);
    expect(wrongly(separable, 0.5)).toEqual([]);
  });

  it("puts each message in the tenth of its probability, a probability of one in the last", () => {
    const tenths = histogram([
      ...points,
      { label: true, languages: "id", probability: 1, row: 7 },
    ]);
    expect(Arr.length(tenths)).toBe(10);
    expect(Arr.map(tenths, ({ yes }) => yes)).toEqual([
      0, 0, 0, 0, 1, 1, 0, 0, 0, 2,
    ]);
    expect(Arr.map(tenths, ({ no }) => no)).toEqual([
      1, 0, 0, 0, 0, 1, 1, 0, 0, 0,
    ]);
    expect(Arr.map(tenths, ({ from }) => from)).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ]);
    expect(Arr.every(histogram([]), ({ no, yes }) => no + yes === 0)).toBe(
      true
    );
  });
});

describe("judgment report best threshold", () => {
  it("is the middle of the thresholds that separate a separable set, in steps of one hundredth", () => {
    // Every threshold from 0.31 to 0.70 finds the three yes and clears the three no.
    expect(bestThreshold(separable)).toBe(0.5);
  });

  it("is a threshold no other beats when the labels overlap", () => {
    const best = bestThreshold(points);
    expect(
      Arr.every(
        Arr.makeBy(100, (index) => (index + 1) / 100),
        (threshold) => balance(points, best) >= balance(points, threshold)
      )
    ).toBe(true);
  });
});

describe("judgment report table", () => {
  const table = judgmentTable("lasting", "message", 0.5, points);

  it("names the judgment and counts the labels, with a table of probabilities by label", () => {
    expect(table).toContain(
      "judgment lasting: 3 messages labelled yes, 3 labelled no"
    );
    expect(table).toContain("probability   yes    no");
    expect(table).toContain("0.0 to 0.1     0     1");
    expect(table).toContain("0.9 to 1.0     1     0");
  });

  it("gives the counts at the threshold of the deployment and at the best one", () => {
    expect(table).toContain("at the threshold of the deployment, 0.50:");
    expect(table).toContain("judged yes             2            2");
    expect(table).toContain("balance 0.500");
    expect(table).toContain(
      `at the threshold that separates best, ${bestThreshold(points).toFixed(2)}:`
    );
  });

  it("names a text judged wrongly by its number, label, probability, language and form, and quotes none", () => {
    expect(table).toContain(
      "judged wrongly at 0.50 (message, label, probability, language, form):"
    );
    expect(table).toContain("    2  yes  0.40  ja  ");
    expect(table).toContain("    3  no   0.62  en  phone");
    expect(table).toContain("    5  no   0.50  ar  ");
  });

  it("names what the judgment is asked about in its counts and in its list of wrong texts", () => {
    const noted = judgmentTable("private", "note", 0.5, points);
    expect(noted).toContain(
      "judgment private: 3 notes labelled yes, 3 labelled no"
    );
    expect(noted).toContain(
      "judged wrongly at 0.50 (note, label, probability, language, form):"
    );
  });
});

describe("judgment report failures", () => {
  it("counts how many texts each kind of failure kept from the measure", () => {
    expect(
      failureLine([
        { reason: "invalid", status: 400, type: "unsupported_parameter" },
        { reason: "invalid", status: 400, type: "unsupported_parameter" },
        { reason: "network" },
        { reason: "unavailable", status: 503 },
      ])
    ).toBe(
      "4 texts failed: invalid 400 unsupported_parameter (2), network (1), unavailable 503 (1)"
    );
  });
});
