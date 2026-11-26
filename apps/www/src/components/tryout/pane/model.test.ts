import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  NO_CLAIMS,
  partPracticeSummary,
  partScore,
  partStep,
  selectPracticePath,
  starsLeft,
} from "@/components/tryout/pane/model";

const scoredVerbal = {
  completedAt: 120_000,
  publishedScore: 725,
  scoreStatus: "provisional" as const,
  sectionKey: "verbal",
  startedAt: 0,
  totalCorrect: 21,
  totalQuestions: 30,
};

const running = {
  completedSectionKeys: ["verbal"],
  resumeSectionKey: "numeric",
  sectionScores: [scoredVerbal],
  status: "in-progress" as const,
};

describe("starsLeft", () => {
  it("gives every section's Stars and the set's own to a learner who holds none", () => {
    expect(starsLeft(["verbal", "numeric"], NO_CLAIMS)).toBe(70);
  });

  it("leaves out the grants a learner already holds", () => {
    expect(
      starsLeft(["verbal", "numeric"], {
        sections: ["verbal"],
        set: false,
        stars: 15,
      })
    ).toBe(55);
    expect(
      starsLeft(["verbal", "numeric"], {
        sections: ["verbal", "numeric"],
        set: true,
        stars: 70,
      })
    ).toBe(0);
  });
});

describe("partStep", () => {
  it("leaves every part to do before the learner starts the set", () => {
    expect(partStep(null, "verbal")).toBe("todo");
  });

  it("marks a running attempt's finished part done, the part it resumes at next, and the rest to do", () => {
    expect(partStep(running, "verbal")).toBe("done");
    expect(partStep(running, "numeric")).toBe("next");
    expect(partStep(running, "english")).toBe("todo");
  });

  it("marks the parts an ended attempt left unfinished missed", () => {
    expect(partStep({ ...running, status: "expired" }, "numeric")).toBe(
      "missed"
    );
    expect(partStep({ ...running, status: "completed" }, "verbal")).toBe(
      "done"
    );
  });
});

describe("partScore", () => {
  it("returns none before an attempt starts or for an unscored part", () => {
    expect(partScore(null, "verbal")).toEqual(Option.none());
    expect(partScore(running, "numeric")).toEqual(Option.none());
  });

  it("returns the score summary of a scored part", () => {
    expect(partScore(running, "verbal")).toEqual(Option.some(scoredVerbal));
  });
});

describe("partPracticeSummary", () => {
  const summaries = [
    { checkedCount: 10, questionCount: 10, sectionKey: "verbal" },
    { checkedCount: 3, questionCount: 15, sectionKey: "numeric" },
  ];

  it("finds a section's practice summary or returns none when unstarted", () => {
    expect(partPracticeSummary(summaries, "numeric")).toEqual(
      Option.some(summaries[1])
    );
    expect(partPracticeSummary(summaries, "english")).toEqual(Option.none());
  });
});

describe("selectPracticePath", () => {
  const sections = [
    {
      publicPath: "try-out/indonesia/snbt/2027/utbk/set-1/verbal",
      sectionKey: "verbal",
    },
    {
      publicPath: "try-out/indonesia/snbt/2027/utbk/set-1/numeric",
      sectionKey: "numeric",
    },
  ];
  const setPublicPath = "try-out/indonesia/snbt/2027/utbk/set-1";

  it("selects the first unfinished section, falling back to the first section or set path", () => {
    expect(
      selectPracticePath({
        sections,
        setPublicPath,
        summaries: [
          { checkedCount: 10, questionCount: 10, sectionKey: "verbal" },
          { checkedCount: 3, questionCount: 15, sectionKey: "numeric" },
        ],
      })
    ).toBe(sections[1].publicPath);
    expect(
      selectPracticePath({
        sections,
        setPublicPath,
        summaries: [
          { checkedCount: 10, questionCount: 10, sectionKey: "verbal" },
          { checkedCount: 15, questionCount: 15, sectionKey: "numeric" },
        ],
      })
    ).toBe(sections[0].publicPath);
    expect(
      selectPracticePath({
        sections: [{ sectionKey: "internal" }],
        setPublicPath,
        summaries: [],
      })
    ).toBe(setPublicPath);
    expect(
      selectPracticePath({
        sections: [],
        setPublicPath,
        summaries: [],
      })
    ).toBe(setPublicPath);
  });
});
