import { describe, expect, it } from "@effect/vitest";
import {
  analyteMoles,
  endPoint,
  hueAfter,
  levelFor,
  pairOf,
  phAfter,
  type Titration,
} from "@repo/design-system/components/contents/chemistry/titration/model";

/** SPM Kimia set 1, question 6: diluted sodium hydroxide against sulfuric acid. */
const diprotic: Titration = {
  analyte: { concentration: 0.1, solute: "sodium-hydroxide", volume: 20 },
  indicator: "phenolphthalein",
  titrant: { concentration: 0.05, solute: "sulfuric-acid" },
};

/** Question 11: one portion of washing soda solution against hydrochloric acid. */
const carbonate: Titration = {
  analyte: { concentration: 0.04, solute: "sodium-carbonate", volume: 25 },
  indicator: "methyl-orange",
  titrant: { concentration: 0.1, solute: "hydrochloric-acid" },
};

/** Question 21: acidified iron(II) sulfate against potassium dichromate(VI). */
const redox: Titration = {
  analyte: { concentration: 0.12, solute: "iron-sulfate", volume: 25 },
  indicator: "none",
  titrant: { concentration: 0.02, solute: "potassium-dichromate" },
};

/** Question 14: hydrochloric acid with sodium hydroxide added to it. */
const acidFlask: Titration = {
  analyte: { concentration: 0.1, solute: "hydrochloric-acid", volume: 50 },
  indicator: "phenolphthalein",
  titrant: { concentration: 0.08, solute: "sodium-hydroxide" },
};

/** The end point of a titration whose pair the lab knows. */
function endOf(titration: Titration) {
  const pair = pairOf(titration);
  if (pair === undefined) {
    throw new Error("unknown pair");
  }
  return endPoint(titration, pair);
}

describe("titration model", () => {
  it("reaches the end point of each item at the volume its working finds", () => {
    expect(endOf(diprotic)).toBeCloseTo(20, 10);
    expect(endOf(carbonate)).toBeCloseTo(20, 10);
    expect(endOf(redox)).toBeCloseTo(25, 10);
    expect(endOf(acidFlask)).toBeCloseTo(62.5, 10);
    expect(analyteMoles(diprotic)).toBeCloseTo(0.002, 12);
  });

  it("reads the pH of a strong acid and a strong base before, at and past the end point", () => {
    expect(phAfter(diprotic, 0)).toBeCloseTo(13, 10);
    expect(phAfter(diprotic, 20)).toBe(7);
    // Past it: 0.0030 mol of hydrogen ions against 0.0020 mol of hydroxide, in 50 cm³.
    expect(phAfter(diprotic, 30)).toBeCloseTo(-Math.log10(0.02), 10);
    // Question 14: 0.0010 mol of hydrogen ions left in 100 cm³.
    expect(phAfter(acidFlask, 50)).toBeCloseTo(2, 10);
    expect(phAfter(carbonate, 10)).toBeUndefined();
    expect(phAfter(redox, 10)).toBeUndefined();
  });

  it("turns phenolphthalein from pink to colourless as an alkali is neutralised, and back as one is added", () => {
    expect(hueAfter(diprotic, 0)).toBe("pink");
    expect(hueAfter(diprotic, 20)).toBe("colourless");
    expect(hueAfter(diprotic, 25)).toBe("colourless");
    expect(hueAfter(acidFlask, 10)).toBe("colourless");
    expect(hueAfter(acidFlask, 70)).toBe("pink");
  });

  it("turns methyl orange from yellow through orange to red", () => {
    expect(hueAfter(carbonate, 0)).toBe("yellow");
    expect(hueAfter(carbonate, 20)).toBe("orange");
    expect(hueAfter(carbonate, 25)).toBe("red");
  });

  it("lets dichromate show its own end point", () => {
    expect(hueAfter(redox, 0)).toBe("pale-green");
    expect(hueAfter(redox, 10)).toBe("green");
    expect(hueAfter(redox, 30)).toBe("orange");
  });

  it("keeps a solution's own colour without an indicator, and knows no pair it was not given", () => {
    const plain: Titration = { ...acidFlask, indicator: "none" };
    const unknown: Titration = {
      analyte: { concentration: 0.1, solute: "iron-sulfate", volume: 25 },
      indicator: "none",
      titrant: { concentration: 0.1, solute: "hydrochloric-acid" },
    };

    expect(hueAfter(plain, 10)).toBe("colourless");
    expect(pairOf(unknown)).toBeUndefined();
    expect(hueAfter(unknown, 10)).toBe("pale-green");
    expect(() => endOf(unknown)).toThrow("unknown pair");
  });
});

describe("liquid level", () => {
  it("fills a cylinder to the height its volume needs, and stops at the top", () => {
    const radius = 0.04;
    const level = levelFor(100, () => radius, 0.2);

    expect(level).toBeCloseTo(100e-6 / (Math.PI * radius ** 2), 6);
    expect(levelFor(1e6, () => radius, 0.2)).toBeCloseTo(0.2, 6);
  });
});
