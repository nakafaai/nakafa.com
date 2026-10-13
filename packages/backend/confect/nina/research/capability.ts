import {
  defineCapability,
  failed,
} from "@repo/backend/confect/nina/capability/define";
import {
  formatSpecialistToolTask,
  getSpecialistToolWords,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { ALLOWED } from "@repo/backend/confect/nina/policy/capability";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { getSourceReferencesFromMessages } from "@repo/backend/confect/nina/research/source";
import { Effect } from "effect";

/** Research's part of the tool policy: where to use it and how to scope its sources. */
const SECTION = `
## deepResearch

Use deepResearch before answering requests for:
- official documentation.
- source-backed claims.
- citations.
- links to sites outside Nakafa.
- current or latest information.
- named products outside Nakafa.
This applies in every user language. Do not answer those requests from memory.

Preserve source-scoping details in request or sourceRequirements:
- Products, APIs, libraries, features, versions, domains, URLs, source constraints, and document titles.
- Official, primary, maintainer, vendor, standards-body, paper-author, or named-domain requirements.

Keep research inputs neutral when sources may be missing or weak:
- Ask for direct-source verification.
- Do not prewrite failed-verification wording.
- Do not tell deepResearch to say something was not found.
`;

/** Researches external, official, current or source-backed information, and reads the outside links the learner sent. */
export const researchCapability = defineCapability({
  continuation:
    "Ask a narrower research question to gather the omitted sources.",
  description:
    "Research external, official, current or source-backed information with web search and source analysis. Preserve the user's source constraints.",
  guideline: {
    entry:
      "deepResearch: external, current, official, or source-backed claims.",
    field:
      "deepResearch.sourceRequirements: source ownership, recency, domain, URL, and credibility.",
    section: SECTION,
  },
  input: researchToolInputSchema,
  offered: () => ALLOWED,
  run: (
    input,
    { context, locale, messages, publish, toolCallId, usageHandler, userId }
  ) =>
    runResearchAgent({
      userId,
      context,
      locale,
      task: formatSpecialistToolTask(input),
      words: getSpecialistToolWords(input),
      sourceReferences: getSourceReferencesFromMessages(messages),
      toolCallId,
      publish,
      usageHandler,
    }).pipe(
      Effect.catchTags({
        ResearchGenerationError: (error) =>
          failed(
            error,
            "External research failed. Tell the learner what this attempt could not verify, which is the request itself, and name a direct channel they can check next. Use only retrieved evidence, do not invent sources, and do not claim that anything is absent or does not exist."
          ),
        ResearchSourceLimitError: ({ maximum }) =>
          Effect.succeed({
            outcome: "limit" as const,
            text: `No sources were fetched. Ask the user to send at most ${maximum} source URLs per request. Do not silently omit their sources or start another research call for this request.`,
          }),
      })
    ),
});
