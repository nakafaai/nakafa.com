import { classify } from "@repo/backend/confect/gateway/classify";
import {
  defineCapability,
  failed,
} from "@repo/backend/confect/nina/capability/define";
import {
  formatSpecialistToolTask,
  nakafaToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { ALLOWED } from "@repo/backend/confect/nina/policy/capability";
import { getNakafaReferencesFromMessages } from "@repo/backend/confect/nina/research/source";
import { Array as Arr, Effect } from "effect";

/** Nakafa's part of the tool policy: where to use it and how to fill its input. */
const SECTION = `
## Nakafa

Answer from the Current Page context when it covers the request.
Use Nakafa first for named educational topics, lesson explanations, study requests, other sections of the current page, and educational practice.
Practice includes warmups, starter examples, hints, quick reviews, quizzes, tryout preparation, and preparation before practice.

Nakafa routing rules:
- A link to Nakafa's own site is Nakafa content: Nakafa reads it, and it never goes to deepResearch.
- If Nakafa cannot read an address the learner sent, tell the learner that page could not be read. Do not describe it.
- Preserve every requested deliverable.
- Include helpful retrieval context: URL, verified status, user goal, subject, grade, topic, article, exercise, or Quran context.
- Search first when the exact content reference is not known.
- Do not add a lesson or concept overview unless the user asks for one.
- For warmups or starter examples followed by practice, ask Nakafa for exercise evidence only; Nina can write a short setup from that evidence.
- If the user asks for explanation plus practice, include both needs.
- If the user only asks for practice, scope Nakafa to exercise retrieval and explanation.

Do not use Nakafa to fill missing evidence for external, current, official-source, or source-owned verification questions.
Use Nakafa after weak external research only for a separate user-requested Nakafa deliverable:
- lessons.
- exercises.
- Quran content.
- articles.
- practice.
`;

/** Retrieves signed Nakafa content, and reads the links to Nakafa's own site that the learner sent. */
export const nakafaCapability = defineCapability({
  continuation:
    "Ask Nakafa for a named section or a narrower request to read the omitted part.",
  description:
    "Retrieve Nakafa educational evidence: lessons, articles, Quran, examples, practice, and other sections of the current page. Select educational content here before verifying its mathematics.",
  guideline: {
    entry:
      "Nakafa: Nakafa-owned lessons, articles, Quran references, and exercises.",
    field:
      "nakafa.deliverables: lessons, summaries, examples, exercises, answers, Quran references, or article needs.",
    section: SECTION,
  },
  input: nakafaToolInputSchema,
  offered: () => ALLOWED,
  run: (input, { context, locale, messages, publish, usageHandler, userId }) =>
    runNakafaAgent({
      userId,
      context,
      locale,
      task: formatSpecialistToolTask(input),
      addresses: Arr.map(
        getNakafaReferencesFromMessages(messages),
        (link) => link.href
      ),
      publish,
      usageHandler,
    }).pipe(
      Effect.catchTag("NakafaGenerationError", (error) =>
        failed(
          { gateway: classify(error.cause) },
          "Nakafa retrieval failed. Use only evidence already available; do not invent content."
        )
      )
    ),
});
