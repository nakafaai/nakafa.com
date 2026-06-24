import {
  createPedagogyRepairUserPrompt,
  createPedagogySystemPrompt,
  createPedagogyUserPrompt,
} from "@repo/ai/nina/pedagogy/prompt";
import type { PedagogyEvidencePacketShape } from "@repo/ai/nina/pedagogy/schema";
import { describe, expect, it } from "vitest";

describe("pedagogy prompts", () => {
  it("asks for Markdown LaTeX narration without forbidding formulas", () => {
    const system = createPedagogySystemPrompt();
    const user = createPedagogyUserPrompt(evidencePacket());

    expect(system).toContain("Use Markdown text");
    expect(user).toMatch(latexDelimiterPromptRule);
    expect(`${system}\n${user}`).not.toMatch(forbiddenPlainTextPromptRules);
  });

  it("builds a bounded repair prompt from the same evidence packet", () => {
    const repair = createPedagogyRepairUserPrompt({
      failure: "pedagogy.output: raw CAS syntax",
      packet: evidencePacket(),
    });

    expect(repair).toContain("Repair the previous math pedagogy output");
    expect(repair).toContain("pedagogy.output: raw CAS syntax");
    expect(repair).toContain("math:solve:prompt:step:0");
    expect(repair).toContain("LaTeX delimiters");
  });
});

const forbiddenPlainTextPromptRules =
  /\b(no Markdown|no formulas|no LaTeX|no arithmetic symbols|plain prose)\b/iu;

const latexDelimiterPromptRule = /LaTeX\s+delimiters/u;

/** Builds the smallest deterministic evidence packet needed by prompt tests. */
function evidencePacket(): PedagogyEvidencePacketShape {
  return {
    evidenceHash: "evidence:test",
    items: [
      {
        expression: "x^2 - 4 = 0",
        kind: "step",
        lane: "derived",
        latex: "x^2 - 4 = 0",
        ref: "math:solve:prompt:step:0",
        summary: "ruleId=cas.solve; output=x=2",
      },
    ],
    locale: "id",
    operation: "solve",
    resultExpression: "x = 2",
    resultLatex: "x = 2",
    workId: "math:solve:prompt",
  };
}
