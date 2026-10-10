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
import {
  formatRuntimePrompt,
  RuntimePromptContextSchema,
} from "@repo/backend/confect/nina/prompt/runtime";
import { formatTaskPrompt } from "@repo/backend/confect/nina/prompt/task";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import dedent from "dedent";
import { Array as Arr, pipe, Schema } from "effect";

/** Runtime context, authenticated role, current page, learner, and focus. */
const SystemPromptPropsSchema = RuntimePromptContextSchema.mapFields(
  (fields) => ({
    ...fields,
    focus: Schema.optional(Schema.String),
    learner: Schema.optional(Schema.String),
    pageContent: Schema.optional(Schema.String),
    summary: Schema.optional(Schema.String),
    userRole: Schema.optional(PromptUserRoleSchema),
  })
);

type SystemPromptProps = typeof SystemPromptPropsSchema.Type;

/**
 * Builds Nina's system prompt with internal LearningCapability policy. Stable
 * instructions lead so provider prompt caching reuses them across turns; the
 * page, which learners share, the learner, question focus, conversation
 * summary, and per-turn runtime facts follow in that order.
 */
export function createNinaPrompt({
  focus,
  learner,
  pageContent,
  summary,
  userRole,
  ...runtime
}: SystemPromptProps) {
  const instructions = createPrompt({
    taskContext: formatIdentityPrompt(userRole),
    toneContext: formatTonePrompt(),
    toolUsageGuidelines: formatToolPolicyPrompt(),
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
      dedent(formatRuntimePrompt(runtime)),
    ],
    Arr.filter((part): part is string => Boolean(part)),
    Arr.join("\n\n")
  );
}
