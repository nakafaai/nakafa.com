import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { describe, expect, it } from "vitest";

const base = {
  currentDate: "May 9, 2026",
  currentPage: {
    locale: "id",
    slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
    verified: true,
  },
  url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
  userLocation: {
    city: "Berlin",
    country: "Germany",
    countryRegion: "Berlin",
    latitude: "52.52",
    longitude: "13.405",
  },
} as const;

describe("nakafaPrompt", () => {
  it("keeps prompt responsibilities in clean sections", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const taskIndex = prompt.indexOf("# Task Instructions");
    const examplesIndex = prompt.indexOf("# Specialist Input Examples");
    const outputIndex = prompt.indexOf("# Output Formatting Guidelines");

    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(taskIndex).toBeGreaterThan(toolIndex);
    expect(examplesIndex).toBeGreaterThan(taskIndex);
    expect(outputIndex).toBeGreaterThan(examplesIndex);

    const toolSection = prompt.slice(toolIndex, taskIndex);
    const taskSection = prompt.slice(taskIndex, examplesIndex);
    const examplesSection = prompt.slice(examplesIndex, outputIndex);
    const outputSection = prompt.slice(outputIndex);

    expect(toolSection).toContain("## Specialist Input Contract");
    expect(toolSection).toContain("## Routing Standard");
    expect(toolSection).toContain("## Nakafa");
    expect(toolSection).toContain("## deepResearch");
    expect(toolSection).toContain("## math");
    expect(toolSection).toContain("## Combining Agents");
    expect(toolSection).not.toContain("Typical Session Workflow");
    expect(taskSection).toContain("Work in order:");
    expect(examplesSection).toContain("Good Nakafa input:");
    expect(examplesSection).toContain("Bad specialist inputs:");
    expect(outputSection).toContain("## Mathematical format");
    expect(outputSection).toContain("## Links");
  });

  it("keeps one stable Nina persona without conflicting harsh-advisor rules", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Be friendly, direct, source-grounded, concise, and age-appropriate."
    );
    expect(prompt).not.toContain("brutally honest");
    expect(prompt).not.toContain("DON'T soften the truth");
    expect(prompt).not.toContain("Hold nothing back");
  });

  it("defines compact specialist inputs without the old task blob", () => {
    const prompt = nakafaPrompt(base);
    const toolSection = prompt.slice(
      prompt.indexOf("# Tool Usage Guidelines"),
      prompt.indexOf("# Task Instructions")
    );

    expect(toolSection).toContain("All specialist tools share compact fields:");
    expect(toolSection).toContain("request: task-relevant user details only.");
    expect(toolSection).toContain("objective: the specialist job only.");
    expect(toolSection).toContain(
      "requirements: real retrieval or verification constraints only; omit when none exist."
    );
    expect(toolSection).toContain("deepResearch.sourceRequirements");
    expect(toolSection).toContain("nakafa.deliverables");
    expect(toolSection).toContain("math.given");
    expect(toolSection).toContain(
      "do not preload solution methods or derived formulas"
    );
    expect(toolSection).toContain(
      "ask math for the valid location and function value"
    );
    expect(toolSection).toContain(
      'Preserve derivation, proof, and "why" deliverables'
    );
    expect(toolSection).toContain(
      "keep connective wording in the user's language"
    );
    expect(toolSection).toContain("preserve technical names and terms exactly");
    expect(toolSection).toContain("avoid copying the full user message");
    expect(toolSection).not.toContain("exact user wording");
    expect(toolSection).not.toContain("deepResearch uses separate fields:");
    expect(toolSection).not.toContain("Markdown brief");
  });

  it("routes evidence through the right specialist before final claims", () => {
    const prompt = nakafaPrompt(base);

    expect(prompt).toContain(
      "Use the smallest reliable evidence path before the final answer"
    );
    expect(prompt).toContain("Nakafa evidence for Nakafa-owned content.");
    expect(prompt).toContain(
      "Source-backed research evidence for external or current claims."
    );
    expect(prompt).toContain("Math evidence for calculations");
    expect(prompt).toContain(
      "If evidence still cannot be gathered, answer with the limitation instead of guessing."
    );
    expect(prompt).toContain(
      "Decide from the user's request and gathered evidence"
    );
    expect(prompt).toContain(
      "not from content slugs, material names, section labels, or UI labels alone."
    );
  });

  it("keeps Nakafa practice selection separate from math verification", () => {
    const prompt = nakafaPrompt(base);

    expect(prompt).toContain("Practice includes warmups");
    expect(prompt).toContain(
      "For warmups or starter examples followed by practice, ask Nakafa for exercise evidence only"
    );
    expect(prompt).toContain(
      "Do not use math as the first or only source for practice sets"
    );
    expect(prompt).toContain("Nakafa selects content.");
    expect(prompt).toContain("math verifies selected calculations.");
    expect(prompt).toContain(
      "Never create practice content inside the math input."
    );
    expect(prompt).toContain(
      "Do not switch to different math content after verification."
    );
  });

  it("keeps failed external research from becoming generic Nakafa fallback", () => {
    const prompt = nakafaPrompt(base);

    expect(prompt).toContain(
      "Do not use Nakafa to fill missing evidence for external, current, official-source, or source-owned verification questions."
    );
    expect(prompt).toContain(
      "Do not switch to generic Nakafa search just to provide something."
    );
    expect(prompt).toContain(
      "Keep it as a process limitation, not a claim that sources, announcements, public information, or confirmations do not exist."
    );
    expect(prompt).toContain(
      "Do not add greetings, advice, encouragement, unrelated Nakafa content, or extra bullets around a limitation-only answer."
    );
  });

  it("keeps final answer formatting explicit but compact", () => {
    const prompt = nakafaPrompt(base);

    expect(prompt).toContain("Always use the user's language.");
    expect(prompt).toContain("Multiple-choice options MUST be formatted");
    expect(prompt).toContain("- A. Option text");
    expect(prompt).toContain("- E. Option text");
    expect(prompt).toContain("Rewrite retrieved $...$ or $$...$$ math to");
    expect(prompt).toContain(
      "Cite external research sources inline in the exact sentence they support."
    );
    expect(prompt).toContain(
      "Never show numeric citation markers or append a source/reference/bibliography section."
    );
    expect(prompt).toContain(
      "Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content."
    );
  });

  it.each([
    "teacher",
    "student",
    "parent",
    "administrator",
  ] as const)("includes compact role guidance for %s", (userRole) => {
    expect(
      nakafaPrompt({
        ...base,
        userRole,
      })
    ).toContain("User is");
  });

  it("includes default role guidance and unverified page context", () => {
    const prompt = nakafaPrompt({
      ...base,
      currentPage: {
        ...base.currentPage,
        verified: false,
      },
    });

    expect(prompt).toContain("User identity is unknown.");
    expect(prompt).toContain("- verified: no");
  });
});
