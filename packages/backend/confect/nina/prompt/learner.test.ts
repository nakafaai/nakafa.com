import { describe, expect, it } from "@effect/vitest";
import type { NinaLearnerProfile } from "@repo/backend/confect/nina/memory.spec";
import {
  formatLearnerProfile,
  formatLearnerPrompt,
} from "@repo/backend/confect/nina/prompt/learner";

const profile: typeof NinaLearnerProfile.Type = {
  focus: "tryout",
  region: "indonesia",
  tryout: {
    correct: 45,
    exam: "snbt",
    finishedAt: Date.UTC(2026, 8, 12),
    score: 612,
    sections: [{ correct: 12, key: "penalaran-umum", total: 30 }],
    set: "set-1",
    status: "provisional",
    total: 120,
  },
  tryoutCountry: "indonesia",
};

describe("Nina learner prompt", () => {
  it("formats account facts, including the latest try-out by section", () => {
    expect(formatLearnerProfile({})).toBeUndefined();
    expect(formatLearnerProfile({ focus: "learning" })).toBe(
      "Account:\n- Focus: learning lessons"
    );
    expect(formatLearnerProfile(profile)).toBe(
      [
        "Account:",
        "- Focus: preparing for try-outs",
        "- Region: indonesia",
        "- Preferred try-out country: indonesia",
        "- Latest finished try-out: snbt set-1 on 2026-09-12, score 612 (provisional), 45 of 120 correct",
        "  - penalaran-umum: 12 of 30 correct",
      ].join("\n")
    );
  });

  it("adds remembered facts, newest first, only while memory holds some", () => {
    expect(formatLearnerPrompt({ facts: [], profile: {} })).toBeUndefined();
    const prompt = formatLearnerPrompt({
      facts: [{ text: "Kelas 11." }, { text: "Suka contoh soal." }],
      profile: { region: "germany" },
    });
    expect(prompt).toContain("# Learner");
    expect(prompt).toContain("- Region: germany");
    expect(prompt).toContain(
      "Remembered from earlier conversations, newest first (the learner can view and delete these in settings):\n- Suka contoh soal.\n- Kelas 11."
    );
    expect(
      formatLearnerPrompt({ facts: [{ text: "Kelas 12." }], profile: {} })
    ).not.toContain("Account:");
  });
});
