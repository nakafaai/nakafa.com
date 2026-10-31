import { describe, expect, it } from "@effect/vitest";
import {
  meanOf,
  transcriptOfLines,
} from "@repo/backend/confect/records/transcript";
import { Option } from "effect";

describe("records/transcript", () => {
  it("rounds a mean half up to two decimals, as Kepmendikdasmen 177/2026 writes its examples", () => {
    expect(meanOf([72.495])).toBe(72.5);
    expect(meanOf([85.754])).toBe(85.75);
    expect(meanOf([72.49, 72.5])).toBe(72.5);
    expect(meanOf([80, 91])).toBe(85.5);
    expect(meanOf([70, 71, 71])).toBe(70.67);
    expect(meanOf([100])).toBe(100);
  });

  it("means each subject over every report, compared without case and named as the newest report names it", () => {
    expect(
      transcriptOfLines([
        {
          className: "Matematika VII-A",
          kktp: "reached",
          subject: "matematika",
          value: 80,
        },
        { className: "VII-A", kktp: "reached", value: 70 },
        {
          className: "Matematika VIII-A",
          kktp: "reached",
          subject: "Matematika",
          value: 91,
        },
      ])
    ).toEqual(
      Option.some({
        average: 77.75,
        subjects: [
          { subject: "Matematika", value: 85.5 },
          { subject: "VII-A", value: 70 },
        ],
      })
    );
  });

  it("gives no transcript without a report line", () => {
    expect(transcriptOfLines([])).toEqual(Option.none());
  });
});
