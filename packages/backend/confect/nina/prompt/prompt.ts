import { formatToolPolicyPrompt } from "@repo/backend/confect/nina/policy/tool";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { formatExamplesPrompt } from "@repo/backend/confect/nina/prompt/examples";
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

/** Runtime context plus authenticated role used to build Nina's system prompt. */
const SystemPromptPropsSchema = RuntimePromptContextSchema.mapFields(
  (fields) => ({
    ...fields,
    userRole: Schema.optional(PromptUserRoleSchema),
  })
);

type SystemPromptProps = Schema.Schema.Type<typeof SystemPromptPropsSchema>;

/** Builds Nina's system prompt with internal LearningCapability policy. */
export function createNinaPrompt({ userRole, ...runtime }: SystemPromptProps) {
  return createPrompt({
    taskContext: formatIdentityPrompt(userRole),
    toneContext: formatTonePrompt(),
    backgroundData: formatRuntimePrompt(runtime),
    toolUsageGuidelines: formatToolPolicyPrompt(),
    detailedTaskInstructions: formatTaskPrompt(),
    examples: formatExamplesPrompt(),
    outputFormatting: formatAnswerPrompt(),
  });
}
