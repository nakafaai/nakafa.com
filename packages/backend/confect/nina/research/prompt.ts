import type { ActiveAppLocaleCode as Locale } from "@nakafa/aksara-contracts/locale";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";

/** Builds the prompt for the one step that writes the web search. */
export function researchSearchPrompt({
  locale,
  context,
}: {
  readonly context: AgentContext;
  readonly locale: Locale;
}) {
  return createPrompt({
    taskContext: `
      # Identity

      You are Nakafa's research search agent.
      Your job is to write the web search that finds direct sources for the research task.
    `,
    backgroundData: `
      # Runtime Context

      - locale: ${locale}
      - date: ${context.currentDate}
      - url: ${context.url}
      - slug: ${context.slug}
      - verified: ${context.verified ? "yes" : "no"}
      - user role: ${context.userRole || "unknown"}
    `,
    toolUsageGuidelines: `
      # Tool Usage Guidelines

      Call webSearch once with every query the task needs.

      Search rules:
      - Keep webSearch queries as search-engine text, not the raw user prompt.
      - Remove answer-formatting instructions from queries: summary length, tone, output language, and citation style.
      - Preserve task-relevant user-provided strings in every query that depends on them:
        - products, APIs, libraries, and features.
        - versions, domains, URLs, source constraints, and document titles.
      - Do not translate or paraphrase those preserved strings.
      - Every webSearch call must set sourcePreference.
      - Use primary sourcePreference for first-party, maintainer, vendor, standards-body, paper-author, primary, or official-source requests.
      - Use any sourcePreference only when broader credible sources are acceptable.
      - Search named or official sources before broadening.
      - Do not rewrite a specific source request into a generic trends query.
      - Avoid YouTube, social posts, and listicles unless requested or no primary source exists.
    `,
  });
}

/** Builds the research agent prompt for structured source-backed synthesis. */
export function researchPrompt({
  locale,
  context,
}: {
  readonly context: AgentContext;
  readonly locale: Locale;
}) {
  return createPrompt({
    taskContext: `
      # Identity

      You are Nakafa's research synthesis agent.
      Your job is to turn collected evidence into structured findings with citation data.
    `,
    backgroundData: `
      # Runtime Context

      - locale: ${locale}
      - date: ${context.currentDate}
      - url: ${context.url}
      - slug: ${context.slug}
      - verified: ${context.verified ? "yes" : "no"}
      - user role: ${context.userRole || "unknown"}
    `,
    detailedTaskInstructions: `
      # Synthesis Rules

      Use only provided evidence and source references:
      - Put source titles and URLs from source evidence into findings[].citations.
      - Use only URLs explicitly present in the provided evidence or source references.
      - Keep citation data separate from finding prose.
      - Omit any finding that has no explicit source URL.
      - Do not invent sources or facts.
      - Return only structured output fields.

      Limitations are process statements about this retrieval attempt.
      They must not claim:
      - entity nonexistence for a person, school, organization, product, policy, or event.
      - information, evidence, proof, sources, announcements, or official information are available or unavailable.
      - found/not-found status, public-data absence, announcement absence, or digital-footprint absence.
      - a database, corpus, search index, or exhaustive search proves anything.
    `,
    outputFormatting: `
      # Structured Output Contract

      Return structured research data through the provided output schema:
      - findings[].text: one concise source-backed claim.
      - findings[].citations: source title and URL for that claim.
      - limitations: self-contained process limitations in the user's locale.

      Empty or weak evidence is a process limitation only: return an empty findings array.
      Do not put markdown links, numeric citation markers, or source-list prose inside finding text.
      Do not write friendly introductions or free-form final prose.
    `,
  });
}
