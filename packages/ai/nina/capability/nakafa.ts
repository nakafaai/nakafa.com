import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import type { ModelId } from "@repo/ai/config/model";
import {
  capabilityResult,
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import { NAKAFA_CAPABILITY } from "@repo/ai/nina/capability/spec";
import { traceLearningCapability } from "@repo/ai/nina/capability/trace";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/ai/nina/policy/capability";
import { getCanonicalNakafaContentUrl } from "@repo/ai/nina/runtime/page";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import type { trackUsage } from "@repo/ai/nina/runtime/usage";
import { NinaWorkspaceRuntime } from "@repo/ai/nina/workspace/runtime";
import {
  formatSpecialistToolTask,
  nakafaToolInputSchema,
} from "@repo/ai/schema/tools";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import type { Locale } from "@repo/contents/_types/content";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { type Context, Effect } from "effect";

/**
 * Creates the Nakafa evidence tool and appends its result to the workspace.
 * Page fetch is consumed at most once by the runtime-owned page fetch state.
 */
export const createNakafaCapabilityTool = Effect.fn(
  "nina.capability.nakafa.tool"
)(function* ({
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
  readonly usage: Effect.Effect.Success<ReturnType<typeof trackUsage>>;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const nakafa = yield* Nakafa;
  const search = yield* NakafaSearch;
  const reporter = yield* NinaReporter;
  const store = yield* NinaStore;
  const workspace = yield* NinaWorkspaceRuntime;

  return tool({
    description:
      "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve requested deliverables in the structured input.",
    inputSchema: nakafaToolInputSchema,
    /** Runs the Nakafa specialist with one-time current-page fetch support. */
    execute: (input, { toolCallId }) =>
      Effect.runPromise(
        traceLearningCapability({
          capability: NAKAFA_CAPABILITY,
          responseMessageIdentifier,
          toolCallId,
          run: Effect.gen(function* () {
            const decision = decideNinaCapability({
              capability: NAKAFA_CAPABILITY,
              context,
            });
            if (decision.state !== "allowed") {
              return deniedCapabilityResult({
                capability: NAKAFA_CAPABILITY,
                decision,
              });
            }

            const needsPageFetch = consumePageFetch();
            if (needsPageFetch) {
              return yield* readCurrentPageEvidence({
                context,
                nakafa,
                reporter,
                toolCallId,
                writer,
              });
            }

            const result = yield* runNakafaAgent({
              context: { ...context, needsPageFetch },
              locale,
              modelId,
              nakafa,
              task: formatSpecialistToolTask(input),
              writer,
            }).pipe(
              Effect.provideService(NakafaSearch, search),
              Effect.map((result) =>
                specialistSuccess({
                  capability: NAKAFA_CAPABILITY,
                  text: result.text,
                  usage: result.usage,
                })
              ),
              Effect.catchAll((error) =>
                recoverSpecialistFailure({
                  component: NAKAFA_CAPABILITY,
                  error,
                  errorLocation: "runNakafaAgent",
                  reporter,
                })
              )
            );

            yield* recordSpecialistUsage({
              addUsage: usage.addUsage,
              component: NAKAFA_CAPABILITY,
              logContext,
              result,
            });

            return result;
          }),
        }).pipe(
          Effect.provideService(NinaReporter, reporter),
          Effect.provideService(NinaStore, store),
          Effect.tap((result) => workspace.appendResult(result)),
          Effect.map((result) => result.text)
        )
      ),
  });
});

/**
 * Reads verified current-page Nakafa content for first workspace evidence.
 */
const readCurrentPageEvidence = Effect.fn("nina.capability.nakafa.page")(
  function* ({
    context,
    nakafa,
    reporter,
    toolCallId,
    writer,
  }: {
    readonly context: AgentContext;
    readonly nakafa: Context.Tag.Service<typeof Nakafa>;
    readonly reporter: Context.Tag.Service<typeof NinaReporter>;
    readonly toolCallId: string;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    const contentRef = getCanonicalNakafaContentUrl(context.url);
    const text = yield* read({
      input: {
        content_ref: NakafaAgentContentRefInputSchema.make(contentRef),
      },
      toolCallId,
      writer,
    }).pipe(
      Effect.provideService(Nakafa, nakafa),
      Effect.catchAll((error) =>
        recoverSpecialistFailure({
          component: NAKAFA_CAPABILITY,
          error,
          errorLocation: "readNakafaCurrentPage",
          reporter,
        })
      )
    );

    if (typeof text !== "string") {
      return text;
    }

    return capabilityResult({
      capability: NAKAFA_CAPABILITY,
      status: "available",
      text,
    });
  }
);
