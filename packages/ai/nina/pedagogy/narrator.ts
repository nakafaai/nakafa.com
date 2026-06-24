import {
  LanguageModelProvider,
  type LanguageModelProviderError,
} from "@repo/ai/config/language/service";
import {
  getFastModelProviderOptions,
  getModelGatewayId,
} from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { subAgentGenerationTimeout } from "@repo/ai/config/timeouts";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import {
  allowedPedagogyEvidenceRefs,
  buildPedagogyEvidencePacket,
} from "@repo/ai/nina/pedagogy/evidence";
import {
  createPedagogyRepairUserPrompt,
  createPedagogySystemPrompt,
  createPedagogyUserPrompt,
} from "@repo/ai/nina/pedagogy/prompt";
import {
  type PedagogyEvidencePacketShape,
  type PedagogyNarrationDraft,
  PedagogyNarrationDraftSchema,
  PedagogyNarrationInput,
  type PedagogyNarrationInputShape,
  PedagogyProjection,
  type PedagogyProjectionShape,
  pedagogyProjectionSchemaVersion,
  pedagogyPromptVersion,
} from "@repo/ai/nina/pedagogy/schema";
import { messageFromUnknown } from "@repo/utilities/error/message";
import { generateText, type LanguageModel, Output, stepCountIs } from "ai";
import { Clock, Effect, Schema } from "effect";

const pedagogyOutputSchema = createEffectSchema(PedagogyNarrationDraftSchema);

/** Raised when live math pedagogy narration cannot be produced safely. */
export class PedagogyNarrationError extends Schema.TaggedError<PedagogyNarrationError>()(
  "PedagogyNarrationError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/** Live LLM Adapter that narrates bounded MathWork evidence for learners. */
export class PedagogyNarrator extends Effect.Service<PedagogyNarrator>()(
  "@repo/ai/PedagogyNarrator",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const languageModels = yield* LanguageModelProvider;

      return {
        /** Produces typed learner narration from deterministic MathWork evidence. */
        narrate: (input: PedagogyNarrationInputShape) =>
          Schema.decodeUnknown(PedagogyNarrationInput)(input).pipe(
            Effect.mapError(
              (error) =>
                new PedagogyNarrationError({
                  message: error.message,
                  source: "pedagogy.input",
                })
            ),
            Effect.flatMap((decoded) =>
              liveNarrate(decoded).pipe(
                Effect.provideService(LanguageModelProvider, languageModels)
              )
            )
          ),
      };
    }),
  }
) {}

/** Runs the AI SDK structured-output call and validates evidence references. */
const liveNarrate = Effect.fn("nina.pedagogy.narrate")(function* (
  input: PedagogyNarrationInputShape
) {
  const packet = buildPedagogyEvidencePacket({
    locale: input.locale,
    result: input.result,
  });
  const languageModels = yield* LanguageModelProvider;
  const model = yield* languageModels
    .resolve(input.modelId)
    .pipe(Effect.mapError(mapLanguageModelError));

  return yield* generateProjectionWithRepair({
    input,
    model,
    packet,
  });
});

/** Runs one normal generation and one bounded repair generation when needed. */
function generateProjectionWithRepair({
  input,
  model,
  packet,
}: {
  readonly input: PedagogyNarrationInputShape;
  readonly model: LanguageModel;
  readonly packet: PedagogyEvidencePacketShape;
}) {
  return generateProjectionAttempt({ input, model, packet }).pipe(
    Effect.catchAll((failure) =>
      generateProjectionAttempt({
        failure,
        input,
        model,
        packet,
      })
    )
  );
}

/** Generates, decodes, and validates one candidate pedagogy projection. */
function generateProjectionAttempt({
  failure,
  input,
  model,
  packet,
}: {
  readonly failure?: PedagogyNarrationError;
  readonly input: PedagogyNarrationInputShape;
  readonly model: LanguageModel;
  readonly packet: PedagogyEvidencePacketShape;
}) {
  return Effect.gen(function* () {
    const generated = yield* generateDraft({
      failure,
      input,
      model,
      packet,
    });
    const narratedAt = yield* Clock.currentTimeMillis;
    const projection = yield* buildProjection({
      draft: generated.draft,
      input,
      narratedAt,
      packet,
    });

    return {
      projection,
      usage: generated.usage,
    };
  });
}

/** Calls AI SDK structured output for one primary or repair narration draft. */
function generateDraft({
  failure,
  input,
  model,
  packet,
}: {
  readonly failure?: PedagogyNarrationError;
  readonly input: PedagogyNarrationInputShape;
  readonly model: LanguageModel;
  readonly packet: PedagogyEvidencePacketShape;
}) {
  return Effect.tryPromise({
    try: () =>
      generateText({
        messages: [
          {
            content: pedagogyUserPrompt({ failure, packet }),
            role: "user",
          },
        ],
        model,
        output: Output.object({
          description:
            "Evidence-bound learner Markdown and LaTeX narration for deterministic MathWork.",
          name: "math_pedagogy_projection",
          schema: pedagogyOutputSchema,
        }),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getFastModelProviderOptions(input.modelId),
        },
        stopWhen: stepCountIs(1),
        system: createPedagogySystemPrompt(),
        temperature: 0.2,
        timeout: subAgentGenerationTimeout,
      }),
    catch: (error) =>
      new PedagogyNarrationError({
        message: messageFromUnknown(error, "Pedagogy narration failed."),
        source: "pedagogy.generate",
      }),
  }).pipe(
    Effect.flatMap((generated) =>
      Schema.decodeUnknown(PedagogyNarrationDraftSchema)(generated.output).pipe(
        Effect.map((draft) => ({
          draft,
          usage: generated.usage,
        })),
        Effect.mapError(
          (error) =>
            new PedagogyNarrationError({
              message: error.message,
              source: "pedagogy.output",
            })
        )
      )
    )
  );
}

/** Selects the normal or repair prompt for one generation attempt. */
function pedagogyUserPrompt({
  failure,
  packet,
}: {
  readonly failure?: PedagogyNarrationError;
  readonly packet: PedagogyEvidencePacketShape;
}) {
  if (!failure) {
    return createPedagogyUserPrompt(packet);
  }

  return createPedagogyRepairUserPrompt({
    failure: `${failure.source}: ${failure.message}`,
    packet,
  });
}

/** Validates model output and attaches non-canonical audit metadata. */
function buildProjection({
  draft,
  input,
  narratedAt,
  packet,
}: {
  readonly draft: PedagogyNarrationDraft;
  readonly input: PedagogyNarrationInputShape;
  readonly narratedAt: number;
  readonly packet: PedagogyEvidencePacketShape;
}): Effect.Effect<PedagogyProjectionShape, PedagogyNarrationError> {
  const allowedRefs = allowedPedagogyEvidenceRefs(packet);
  const invalidRef = firstInvalidEvidenceRef({ allowedRefs, draft });

  if (invalidRef) {
    return Effect.fail(
      new PedagogyNarrationError({
        message: `Pedagogy sentence referenced unknown evidence: ${invalidRef}.`,
        source: "pedagogy.refs",
      })
    );
  }

  return Effect.succeed(
    PedagogyProjection.make({
      evidenceHash: packet.evidenceHash,
      kind: "math-pedagogy-projection",
      locale: input.locale,
      model: {
        gatewayModelId: getModelGatewayId(input.modelId),
        modelId: input.modelId,
        promptVersion: pedagogyPromptVersion,
        provider: "ai-gateway",
        schemaVersion: pedagogyProjectionSchemaVersion,
      },
      narratedAt,
      sentences: draft.sentences.map((sentence, index) => ({
        evidenceRefs: [...sentence.evidenceRefs],
        id: `${packet.workId}:pedagogy:${index}`,
        text: sentence.text,
      })),
      workId: packet.workId,
    })
  );
}

/** Maps model-provider failures into the narrator's typed error channel. */
function mapLanguageModelError(error: LanguageModelProviderError) {
  return new PedagogyNarrationError({
    message: error.message,
    source: error.source,
  });
}

/** Returns the first model-supplied evidence ref that is not in MathWork. */
function firstInvalidEvidenceRef({
  allowedRefs,
  draft,
}: {
  readonly allowedRefs: ReadonlySet<string>;
  readonly draft: PedagogyNarrationDraft;
}) {
  for (const sentence of draft.sentences) {
    const invalidRef = sentence.evidenceRefs.find(
      (ref) => !allowedRefs.has(ref)
    );

    if (invalidRef) {
      return invalidRef;
    }
  }

  return;
}
