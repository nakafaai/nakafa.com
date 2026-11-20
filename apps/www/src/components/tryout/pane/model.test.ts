import { describe, expect, it } from "@effect/vitest";
import { NO_CLAIMS, partStep, starsLeft } from "@/components/tryout/pane/model";

const running = {
  completedSectionKeys: ["verbal"],
  resumeSectionKey: "numeric",
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
