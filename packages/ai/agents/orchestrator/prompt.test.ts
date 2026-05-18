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
  it("keeps tool, task, and output sections separate", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const taskIndex = prompt.indexOf("# Task Instructions");
    const workflowIndex = prompt.indexOf("## Typical Session Workflow");
    const recoveryIndex = prompt.indexOf("## Evidence Recovery");
    const examplesIndex = prompt.indexOf("# Task Brief Examples");
    const outputIndex = prompt.indexOf("# Output Formatting Guidelines");

    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(taskIndex).toBeGreaterThan(toolIndex);
    expect(workflowIndex).toBeGreaterThan(taskIndex);
    expect(recoveryIndex).toBeGreaterThan(workflowIndex);
    expect(examplesIndex).toBeGreaterThan(recoveryIndex);
    expect(outputIndex).toBeGreaterThan(examplesIndex);

    const toolSection = prompt.slice(toolIndex, taskIndex);
    const taskSection = prompt.slice(taskIndex, examplesIndex);
    const examplesSection = prompt.slice(examplesIndex, outputIndex);
    const outputSection = prompt.slice(outputIndex);

    expect(toolSection).toContain(
      "Every specialized agent task MUST be one concise Markdown brief"
    );
    expect(toolSection).toContain("## Decision standard");
    expect(toolSection).not.toContain("Typical Session Workflow");
    expect(taskSection).toContain("Understand the user's goal.");
    expect(taskSection).toContain("source-backed research is the answer gate");
    expect(taskSection).not.toContain("Multiple-choice options MUST");
    expect(examplesSection).toContain("## Good task brief");
    expect(examplesSection).toContain("## Bad task briefs");
    expect(outputSection).toContain("Multiple-choice options MUST");
    expect(outputSection).not.toContain("Every specialized agent task MUST");
  });

  it("requires markdown bullets for multiple-choice options", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Multiple-choice options MUST be formatted as one markdown bullet per option:"
    );
    expect(prompt).toContain("- A. Option text");
    expect(prompt).toContain("- E. Option text");
    expect(prompt).toContain(
      "NEVER write multiple-choice options inline in one paragraph."
    );
    expect(prompt).toContain(
      "NEVER rely on raw line breaks without bullet markers for multiple-choice options."
    );
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

  it("routes math requests through deterministic math evidence", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain("Use for math that needs deterministic evidence.");
    expect(prompt).toContain("Use math to verify:");
    expect(prompt).toContain("user-provided expressions.");
    expect(prompt).toContain("user-provided data.");
    expect(prompt).toContain(
      "math content already retrieved from another evidence path."
    );
    expect(prompt).toContain(
      "Do not use math as the first or only source for educational practice sets:"
    );
    expect(prompt).toContain(
      "- Arithmetic, algebra, equations, and inequalities."
    );
    expect(prompt).toContain("- Calculus and series.");
    expect(prompt).toContain("- Geometry and discrete math.");
    expect(prompt).toContain(
      "If deterministic math is inconclusive, explain the limitation clearly."
    );
    expect(prompt).toContain("For multi-part math requests:");
    expect(prompt).toContain(
      "Enumerate each requested calculation or verification in the math task."
    );
    expect(prompt).toContain(
      'Do not collapse several requested computations into a generic task such as "verify these calculations".'
    );
  });

  it("teaches Nina to combine specialized agents when evidence spans domains", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Ground factual educational answers in the smallest reliable evidence path before the final answer"
    );
    expect(prompt).toContain(
      "Answer directly only when the request does not need factual, source-specific, current, or mathematical evidence:"
    );
    expect(prompt).toContain(
      "Use more than one specialized agent when the answer needs more than one kind of evidence."
    );
    expect(prompt).toContain(
      "Every specialized agent task MUST be one concise Markdown brief"
    );
    expect(prompt).toContain("# User Request");
    expect(prompt).toContain("# Task");
    expect(prompt).toContain(
      "Do not split the same meaning across separate parameters."
    );
    expect(prompt).toContain(
      "Do not route from content slugs, material names, section labels, or UI labels alone."
    );
    expect(prompt).toContain(
      "- Math evidence for calculations, formulas, numeric answers, answer keys, and equivalence checks."
    );
    expect(prompt).toContain(
      "- Math evidence for probability, statistics, matrix properties, geometry, and discrete-counting claims."
    );
    expect(prompt).toContain("If a claim lacks the needed evidence:");
    expect(prompt).toContain("- Call the matching specialist.");
    expect(prompt).toContain(
      "Use math after Nakafa when retrieved content includes calculations, formulas, answers, or equivalence checks."
    );
    expect(prompt).toContain("- Named educational topics.");
    expect(prompt).toContain(
      '- Practice requests, even when the user does not explicitly say "Nakafa".'
    );
    expect(prompt).toContain(
      "- Educational practice sets, warmups, quizzes, and tryout preparation."
    );
    expect(prompt).toContain(
      "- Examples, hints, or review tasks that need content selection before math verification."
    );
    expect(prompt).toContain(
      "Treat practice-adjacent requests as practice deliverables:"
    );
    expect(prompt).toContain("- Starter examples.");
    expect(prompt).toContain("- Preparation before practice.");
    expect(prompt).toContain(
      "Do not add a separate lesson or concept overview unless the user asks for one."
    );
    expect(prompt).toContain(
      "For warmups or starter examples followed by practice, ask Nakafa for exercise evidence only."
    );
    expect(prompt).toContain(
      "Preserve every requested deliverable in the Nakafa request."
    );
    expect(prompt).toContain(
      "When the user only asks for practice, keep the Nakafa task scoped to exercise retrieval and explanation."
    );
    expect(prompt).toContain(
      "- Nakafa lessons, exercises, Quran, or articles."
    );
    expect(prompt).toContain("- School or university learning and practice.");
    expect(prompt).toContain("- Nakafa selects the content.");
    expect(prompt).toContain("- math verifies the selected calculations.");
    expect(prompt).toContain(
      "Include the exact example, exercise, answer key, and numeric claims that will appear in the final answer."
    );
    expect(prompt).toContain("When specialized agents are independent:");
    expect(prompt).toContain("Call them in parallel in the same step.");
    expect(prompt).toContain(
      "Do not wait for one result before starting another."
    );
    expect(prompt).toContain(
      "Use math after deepResearch when researched numbers or claims need:"
    );
    expect(prompt).toContain("calculation.");
    expect(prompt).toContain("comparison.");
    expect(prompt).toContain(
      "Never invent anything without the relevant evidence:"
    );
    expect(prompt).toContain("source-specific content.");
    expect(prompt).toContain("verified math.");
    expect(prompt).toContain(
      "Keep one product, domain, document, or official source scoped to the requested source"
    );
    expect(prompt).toContain(
      "Use deepResearch before answering any request for:"
    );
    expect(prompt).toContain("- Official documentation.");
    expect(prompt).toContain(
      "Preserve the user's exact wording for named entities:"
    );
    expect(prompt).toContain("- APIs and libraries.");
    expect(prompt).toContain(
      "Do not summarize away source-ownership constraints."
    );
    expect(prompt).toContain("If a specialist agent returns an error:");
    expect(prompt).toContain(
      "Do not call the same specialist again with the same request."
    );
    expect(prompt).toContain("This applies in every user language.");
    expect(prompt).toContain(
      "I want a challenging SNBT number-pattern practice question."
    );
    expect(prompt).toContain(
      "Preserve the user's language from runtime context."
    );
    expect(prompt).toContain(
      "Use only the selected exercise evidence. Do not replace the exercise with a different problem."
    );
    expect(prompt).toContain(
      "Routes from metadata instead of the actual request and evidence."
    );
  });

  it("does not let failed external research fall back to generic Nakafa evidence", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain("Do not use Nakafa to fill missing evidence for:");
    expect(prompt).toContain("external verification questions.");
    expect(prompt).toContain("current verification questions.");
    expect(prompt).toContain("official-source verification questions.");
    expect(prompt).toContain("source-owned verification questions.");
    expect(prompt).toContain(
      "After deepResearch returns weak or missing evidence for an external, current, official, or source-owned claim:"
    );
    expect(prompt).toContain(
      "Do not switch to generic Nakafa search just to provide something."
    );
    expect(prompt).toContain("If no source-backed finding is available:");
    expect(prompt).toContain(
      "Give the limitation in the final answer and stop."
    );
    expect(prompt).toContain(
      "Do not replace it with unrelated Nakafa content."
    );
  });

  it("requires dollar-delimited evidence math to be rewritten for final answers", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "When retrieved evidence contains $...$ or $$...$$ math, rewrite it to"
    );
  });

  it("keeps external research citations without exposing Nakafa links", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Cite external research sources inline in the exact sentence they support."
    );
    expect(prompt).toContain("When research evidence contains markdown links:");
    expect(prompt).toContain(
      "Preserve those links in the final answer for every claim that uses that evidence."
    );
    expect(prompt).toContain(
      "Do not add product homepages, documentation links, or source links from memory."
    );
    expect(prompt).toContain(
      "When research evidence contains technical details, preserve them exactly:"
    );
    expect(prompt).toContain(
      "Do not add parent objects, flags, wrappers, or options that are not present in the evidence."
    );
    expect(prompt).toContain(
      "Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content."
    );
    expect(prompt).toContain(
      "Never show numeric citation markers such as [1] or [4, 21, 23] to users."
    );
    expect(prompt).toContain(
      "Convert any research citation indexes into markdown links using the cited source URLs."
    );
    expect(prompt).toContain(
      "Never append a final source, reference, citation, or bibliography section in any language."
    );
  });

  it.each([
    "teacher",
    "student",
    "parent",
    "administrator",
  ] as const)("includes role guidance for %s", (userRole) => {
    expect(
      nakafaPrompt({
        ...base,
        userRole,
      })
    ).toContain("User is");
  });

  it("includes default role guidance when the role is unknown", () => {
    expect(nakafaPrompt(base)).toContain("User identity is unknown.");
  });

  it("marks unverified current pages in the prompt context", () => {
    expect(
      nakafaPrompt({
        ...base,
        currentPage: {
          ...base.currentPage,
          verified: false,
        },
      })
    ).toContain("verified: no");
  });
});
