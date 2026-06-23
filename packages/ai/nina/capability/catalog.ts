import type { ModelId } from "@repo/ai/config/model";
import { createMathCapabilityTool } from "@repo/ai/nina/capability/math";
import { createNakafaCapabilityTool } from "@repo/ai/nina/capability/nakafa";
import { createResearchCapabilityTool } from "@repo/ai/nina/capability/research";
import {
  MATH_CAPABILITY,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import type { NinaToolSet } from "@repo/ai/nina/runtime/step";
import type { trackUsage } from "@repo/ai/nina/runtime/usage";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import type { LogContext } from "@repo/utilities/logging/types";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

type NinaUsage = Effect.Effect.Success<ReturnType<typeof trackUsage>>;

/**
 * Builds Nina's internal AI SDK tool catalog for one turn.
 *
 * The catalog is only the public tool-set assembly seam. Individual capability
 * Modules own specialist execution, tracing, usage accounting, and workspace
 * contribution appends so this file does not become the orchestration sink.
 */
export const createNinaCapabilityCatalog = Effect.fn("nina.capability.catalog")(
  function* ({
    context,
    locale,
    logContext,
    modelId,
    responseMessageIdentifier,
    consumePageFetch,
    usage,
    writer,
  }: {
    readonly consumePageFetch: () => boolean;
    readonly context: AgentContext;
    readonly locale: Locale;
    readonly logContext: LogContext;
    readonly modelId: ModelId;
    readonly responseMessageIdentifier: string;
    readonly usage: NinaUsage;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    return {
      [NAKAFA_CAPABILITY]: yield* createNakafaCapabilityTool({
        context,
        locale,
        logContext,
        modelId,
        responseMessageIdentifier,
        consumePageFetch,
        usage,
        writer,
      }),
      [RESEARCH_CAPABILITY]: yield* createResearchCapabilityTool({
        context,
        locale,
        logContext,
        modelId,
        responseMessageIdentifier,
        usage,
        writer,
      }),
      [MATH_CAPABILITY]: yield* createMathCapabilityTool({
        context,
        locale,
        logContext,
        modelId,
        responseMessageIdentifier,
        usage,
        writer,
      }),
    } satisfies NinaToolSet;
  }
);
