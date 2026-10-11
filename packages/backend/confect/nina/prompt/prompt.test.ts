import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { NinaContextPack } from "@repo/backend/confect/nina/contract/pack";
import { createNinaPrompt } from "@repo/backend/confect/nina/prompt/prompt";

const nina = {
  learning: {
    assetId: "asset:id:material:mathematics:integral:riemann-sum",
    contentId: "asset:id:material:mathematics:integral:riemann-sum",
    locale: "id",
    materialKey: "mathematics",
    section: "subject-lesson",
    slug: "materi/matematika/integral/jumlahan-riemann",
    sourcePath: "material/lesson/mathematics/integral/riemann-sum",
    title: "Jumlahan Riemann",
    url: "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann",
    verified: true,
  },
  snapshot: {
    capturedAt: "2026-05-09T00:00:00.000Z",
    learning: {
      assetId: "asset:id:material:mathematics:integral:riemann-sum",
      contentId: "asset:id:material:mathematics:integral:riemann-sum",
      locale: "id",
      materialKey: "mathematics",
      section: "subject-lesson",
      slug: "materi/matematika/integral/jumlahan-riemann",
      sourcePath: "material/lesson/mathematics/integral/riemann-sum",
      title: "Jumlahan Riemann",
      url: "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann",
      verified: true,
    },
    source: "current-page",
    tools: {
      allowDeepResearch: true,
      allowMath: true,
      allowNakafa: true,
      allowPageFetch: true,
      evidenceScope: "verified-page",
    },
  },
  tools: {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch: true,
    evidenceScope: "verified-page",
  },
  transition: {
    reason: "page-context",
    toContextKey: "canonical:materi/matematika/integral/jumlahan-riemann",
  },
} satisfies NinaContextPack;

const base = {
  currentDate: "May 9, 2026",
  currentPage: {
    locale: "id",
    slug: "materi/matematika/integral/jumlahan-riemann",
    verified: true,
  },
  url: "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann",
  nina,
} as const;

describe("createNinaPrompt", () => {
  it("keeps prompt responsibilities in clean sections", () => {
    const prompt = createNinaPrompt({
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
    expect(outputSection).toContain(
      "indent that child content under the list item"
    );
  });

  it("keeps one stable Nina persona without conflicting harsh-advisor rules", () => {
    const prompt = createNinaPrompt({
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
    const prompt = createNinaPrompt(base);
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
    const prompt = createNinaPrompt(base);

    expect(prompt).toContain(
      "Use the smallest reliable evidence path before the final answer"
    );
    expect(prompt).toContain("Nakafa evidence for Nakafa-owned content.");
    expect(prompt).toContain(
      "Source-backed research evidence for external or current claims."
    );
    expect(prompt).toContain("Math evidence for calculations");
    expect(prompt).toContain(
      "Decide from the user's request and gathered evidence"
    );
    expect(prompt).toContain(
      "not from content slugs, material names, section labels, or UI labels alone."
    );
  });

  it("keeps Nakafa practice selection separate from math verification", () => {
    const prompt = createNinaPrompt(base);

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
    const prompt = createNinaPrompt(base);

    expect(prompt).toContain(
      "Do not use Nakafa to fill missing evidence for external, current, official-source, or source-owned verification questions."
    );
    expect(prompt).toContain(
      "Do not switch to generic Nakafa search just to provide something."
    );
    expect(prompt).toContain(
      "Keep it as a process limitation, not a claim that sources, announcements, public information, or confirmations do not exist."
    );
  });

  it("answers with the findings and their citations when research returns findings", () => {
    const prompt = createNinaPrompt(base);
    const taskSection = prompt.slice(
      prompt.indexOf("# Task Instructions"),
      prompt.indexOf("# Specialist Input Examples")
    );

    expect(taskSection).toContain(
      "If research returns findings (bullets with a source link):"
    );
    expect(taskSection).toContain(
      "Answer with the findings and their citations."
    );
  });

  it("says what findings that cover less than asked do cover, and where to check the rest, even when research returns no limitation", () => {
    const prompt = createNinaPrompt(base);
    const taskSection = prompt.slice(
      prompt.indexOf("# Task Instructions"),
      prompt.indexOf("# Specialist Input Examples")
    );

    expect(taskSection).toContain(
      "If the findings cover less than the learner asked, such as another year or version:"
    );
    expect(taskSection).toContain(
      "Say plainly what they cover and what could not be verified, in the words of the limitations (bullets without a source link) when there are any, and never as a claim that anything does not exist or was not announced."
    );
    expect(taskSection).toContain(
      "Name where the learner can check the rest, such as the official site the findings come from."
    );
    expect(taskSection).not.toContain("If research returns findings and");
  });

  it("tells the learner what could not be verified and to name a direct channel when research returns no finding", () => {
    const prompt = createNinaPrompt(base);
    const taskSection = prompt.slice(
      prompt.indexOf("# Task Instructions"),
      prompt.indexOf("# Specialist Input Examples")
    );

    expect(taskSection).toContain(
      "If research returns no source-backed finding:"
    );
    expect(taskSection).toContain(
      "Tell the learner what could not be verified, in the words of the research limitations when there are any, and name a direct channel they can check next."
    );
  });

  it("bars greetings, advice, filler and extra bullets around a no-finding answer, except the direct channel it requires", () => {
    const prompt = createNinaPrompt(base);
    const taskSection = prompt.slice(
      prompt.indexOf("# Task Instructions"),
      prompt.indexOf("# Specialist Input Examples")
    );

    expect(taskSection).toContain(
      "Apart from the direct channel, do not add greetings, advice, encouragement, unrelated Nakafa content, or extra bullets."
    );
    expect(taskSection).not.toContain("- Do not add greetings, advice");
    expect(taskSection).not.toContain("limitation-only");
  });

  it("writes a research limitation in the words of the limitation, with one or two natural sentences as enough rather than required, and no found or not-found wording", () => {
    const prompt = createNinaPrompt(base);
    const outputSection = prompt.slice(
      prompt.indexOf("## Research limitations"),
      prompt.indexOf("## Mathematical format")
    );

    expect(outputSection).toContain(
      "Write a research limitation in the user's language, in the words of the limitation."
    );
    expect(outputSection).toContain("One or two natural sentences are enough.");
    expect(outputSection).toContain(
      "Do not say information, evidence, proof, announcements, or sources were found or not found."
    );
    expect(outputSection).not.toContain("as one or two natural sentences");
  });

  it("makes saying what the sources cover and do not state the one exception to the found and not-found ban, stated after it", () => {
    const prompt = createNinaPrompt(base);
    const outputSection = prompt.slice(
      prompt.indexOf("## Research limitations"),
      prompt.indexOf("## Mathematical format")
    );

    expect(outputSection).toContain(
      "Saying what the sources cover and do not state is the one exception to that: it describes only those sources. Never widen it into a claim about the world."
    );
    expect(
      outputSection.indexOf("is the one exception to that")
    ).toBeGreaterThan(outputSection.indexOf("were found or not found."));
  });

  it("says what could not be verified, never to answer with the limitation, when evidence cannot be gathered or a specialist errors", () => {
    const prompt = createNinaPrompt(base);

    expect(prompt).toContain(
      "If evidence still cannot be gathered, say what could not be verified instead of guessing."
    );
    expect(prompt).toContain(
      "- Otherwise say plainly what could not be verified."
    );
    expect(prompt).not.toContain("answer with the limitation");
    expect(prompt).not.toContain("answer with a clear limitation");
  });

  it("has no rule that makes a lone limitation sentence the whole answer", () => {
    const prompt = createNinaPrompt(base);

    expect(prompt).not.toContain("single limitation sentence");
    expect(prompt).not.toContain("Limitation-only research answers");
    expect(prompt).not.toContain("as the full answer");
    expect(prompt).not.toContain("Do not paraphrase");
    expect(prompt).not.toContain("Use the research limitation as the answer");
  });

  it("keeps final answer formatting explicit but compact", () => {
    const prompt = createNinaPrompt(base);

    expect(prompt).toContain("Always use the user's language.");
    expect(prompt).toContain(
      'Use ```mermaid title="..." description="..." for helpful flowcharts, graphs, and timelines.'
    );
    expect(prompt).toContain(
      "The title and description are required, must match the response language, and must not repeat each other."
    );
    expect(prompt).toContain(
      'Inside Mermaid labels, use quoted Mermaid math syntax like "$$CO_2$$"; do not use Markdown math delimiters like \\(CO_2\\).'
    );
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

  it.each(["teacher", "student", "parent", "administrator"] as const)(
    "includes compact role guidance for %s",
    (userRole) => {
      expect(
        createNinaPrompt({
          ...base,
          userRole,
        })
      ).toContain("User is");
    }
  );

  it("includes the selected curriculum preference", () => {
    const prompt = createNinaPrompt({
      ...base,
      curriculumPreference: {
        program: {
          key: LearningProgramKeySchema.make("cambridge-international"),
          title: "Cambridge International",
        },
      },
    });

    expect(prompt).toContain("- curriculum preference: selected");
    expect(prompt).toContain("- curriculum: Cambridge International");
    expect(prompt).toContain("- curriculum key: cambridge-international");
  });

  it("includes default role guidance and unverified page context", () => {
    const prompt = createNinaPrompt({
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
