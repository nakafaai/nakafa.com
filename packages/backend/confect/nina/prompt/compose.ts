import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import {
  formatEvidencePrompt,
  formatToolPolicyPrompt,
} from "@repo/backend/confect/nina/policy/tool";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { formatExamplesPrompt } from "@repo/backend/confect/nina/prompt/examples";
import { formatFocusTaskPrompt } from "@repo/backend/confect/nina/prompt/focus";
import { formatAnswerPrompt } from "@repo/backend/confect/nina/prompt/format";
import {
  formatIdentityPrompt,
  formatTonePrompt,
} from "@repo/backend/confect/nina/prompt/persona";
import { formatTaskPrompt } from "@repo/backend/confect/nina/prompt/task";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import { Array as Arr, pipe, Schema } from "effect";

/**
 * Authenticated role, current page, learner, question focus, and summary, and
 * the capabilities Nina is offered in the turn (`capabilities`). The caller
 * always says which: a prompt that left it out would describe tools that Nina
 * is, or is not, given.
 */
const SystemPromptPropsSchema = Schema.Struct({
  capabilities: Schema.Array(LearningCapabilityNameSchema),
  focus: Schema.optional(Schema.String),
  learner: Schema.optional(Schema.String),
  pageContent: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  userRole: Schema.optional(PromptUserRoleSchema),
});

type SystemPromptProps = typeof SystemPromptPropsSchema.Type;

/**
 * Builds Nina's system prompt with internal LearningCapability policy. Stable
 * instructions lead so provider prompt caching reuses them across turns; the
 * page, which learners share, the learner, question focus, and conversation
 * summary follow in that order. Nothing in it changes between the turns of a
 * chat except what the learner or Nina added: the date, the page URL, and the
 * rest of a turn's runtime facts travel with the learner's message instead.
 */
export function createNinaPrompt({
  capabilities,
  focus,
  learner,
  pageContent,
  summary,
  userRole,
}: SystemPromptProps) {
  const instructions = createPrompt({
    taskContext: formatIdentityPrompt(userRole),
    toneContext: formatTonePrompt(),
    toolUsageGuidelines: formatToolPolicyPrompt({ capabilities }),
    detailedTaskInstructions: focus
      ? Arr.join([formatTaskPrompt(), formatFocusTaskPrompt()], "\n\n")
      : formatTaskPrompt(),
    examples: formatExamplesPrompt(),
    outputFormatting: Arr.join(
      [formatAnswerPrompt(), formatEvidencePrompt()],
      "\n\n"
    ),
  });
  return pipe(
    [
      instructions,
      pageContent,
      learner,
      focus,
      summary &&
        `# Conversation Summary\n\nEarlier turns of this conversation:\n\n${summary}`,
    ],
    Arr.filter((part): part is string => Boolean(part)),
    Arr.join("\n\n")
  );
}
