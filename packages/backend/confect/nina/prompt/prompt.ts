import { formatToolPolicyPrompt } from "@repo/backend/confect/nina/policy/tool";
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
import { Schema } from "effect";

/** Runtime context, authenticated role and any verified question focus. */
const SystemPromptPropsSchema = RuntimePromptContextSchema.mapFields(
  (fields) => ({
    ...fields,
    focus: Schema.optional(Schema.String),
    userRole: Schema.optional(PromptUserRoleSchema),
  })
);

type SystemPromptProps = Schema.Schema.Type<typeof SystemPromptPropsSchema>;

/** Builds Nina's system prompt with internal LearningCapability policy. */
export function createNinaPrompt({
  focus,
  userRole,
  ...runtime
}: SystemPromptProps) {
  return createPrompt({
    taskContext: formatIdentityPrompt(userRole),
    toneContext: formatTonePrompt(),
    backgroundData: [formatRuntimePrompt(runtime), focus]
      .filter(Boolean)
      .join("\n\n"),
    toolUsageGuidelines: formatToolPolicyPrompt(),
    detailedTaskInstructions: focus
      ? [formatTaskPrompt(), formatFocusTaskPrompt()].join("\n\n")
      : formatTaskPrompt(),
    examples: formatExamplesPrompt(),
    outputFormatting: formatAnswerPrompt(),
  });
}
