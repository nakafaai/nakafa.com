import { formatExamplesPrompt } from "@repo/ai/agents/orchestrator/examples";
import { formatAnswerPrompt } from "@repo/ai/agents/orchestrator/format";
import {
  formatIdentityPrompt,
  formatTonePrompt,
} from "@repo/ai/agents/orchestrator/persona";
import {
  formatRuntimePrompt,
  RuntimePromptContextSchema,
} from "@repo/ai/agents/orchestrator/runtime";
import { formatTaskPrompt } from "@repo/ai/agents/orchestrator/task";
import { formatToolPolicyPrompt } from "@repo/ai/agents/orchestrator/tools";
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

/** Builds Nina's orchestrator prompt with routing rules for specialist agents. */
export function nakafaPrompt({ userRole, ...runtime }: SystemPromptProps) {
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
