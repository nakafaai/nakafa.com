import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import { describe, expect, it } from "vitest";

describe("nakafaSuggestions", () => {
  it("keeps Indonesian output instructions without mixed-language examples", () => {
    const prompt = nakafaSuggestions({ locale: "id" });

    expect(prompt).toContain("Always respond in Indonesian");
    expect(prompt).toContain(
      "Ask for a similar practice problem in Indonesian"
    );
    expect(prompt).not.toContain("Beri aku soal mirip untuk latihan");
    expect(prompt).not.toContain("Give me another similar problem");
  });

  it("keeps English suggestion instructions in English", () => {
    const prompt = nakafaSuggestions({ locale: "en" });

    expect(prompt).toContain("Always respond in English");
    expect(prompt).toContain("Give me another similar problem to practice");
    expect(prompt).not.toContain("Beri aku soal mirip untuk latihan");
  });
});
