import { formatToolPolicyPrompt } from "@repo/ai/nina/policy/tool";
import { formatExamplesPrompt } from "@repo/ai/nina/prompt/examples";
import { formatAnswerPrompt } from "@repo/ai/nina/prompt/format";
import {
  formatIdentityPrompt,
  formatTonePrompt,
} from "@repo/ai/nina/prompt/persona";
import {
  formatRuntimePrompt,
  RuntimePromptContextSchema,
} from "@repo/ai/nina/prompt/runtime";
import { formatTaskPrompt } from "@repo/ai/nina/prompt/task";
import { createPrompt } from "@repo/ai/prompt/utils";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { Schema } from "effect";

/** Runtime context plus authenticated role used to build Nina's system prompt. */
const SystemPromptPropsSchema = Schema.extend(
  RuntimePromptContextSchema,
  Schema.Struct({
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
