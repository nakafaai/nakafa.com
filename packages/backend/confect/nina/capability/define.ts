import { createTool, type UsageHandler } from "@convex-dev/agent";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type {
  ActionCtx,
  QueryRunner,
  VectorSearch,
} from "@repo/backend/confect/_generated/services";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import type { Gateway } from "@repo/backend/confect/gateway/handle";
import type { ChatStep } from "@repo/backend/confect/nina/capability/deadline";
import type { Held } from "@repo/backend/confect/nina/capability/held";
import {
  type CapabilityOutput,
  type CapabilityProgress,
  streamCapability,
} from "@repo/backend/confect/nina/capability/progress";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  type CapabilityDecision,
  type CapabilityDenied,
  deniedCapabilityResult,
  type OfferContext,
} from "@repo/backend/confect/nina/policy/capability";
import type { Locale } from "@repo/contents/content";
import type { FlexibleSchema, ModelMessage, Tool } from "ai";
import {
  Context,
  Effect,
  MutableHashMap,
  Record as Rec,
  Schema,
  Stream,
} from "effect";

const outputSchema = createEffectSchema(CapabilityOutputSchema);

/**
 * The facts of one turn that its capabilities run in. The turn provides them
 * when it builds its tools, next to the chat step that holds every run.
 * `held` keeps the answers that the conversation must not store.
 */
export class CapabilityTurn extends Context.Service<
  CapabilityTurn,
  {
    readonly context: AgentContext;
    readonly held: Held;
    readonly locale: Locale;
    readonly usageHandler: UsageHandler;
    readonly userId: Docs["users"]["_id"];
  }
>()("@repo/backend/confect/nina/capability/define/CapabilityTurn") {}

/** The services that a capability's run may use. */
type RunServices = ActionCtx | Gateway | QueryRunner | VectorSearch;

/** The services a tool runs in: those of its run, the turn, and the chat step that holds it. */
type ToolServices = RunServices | CapabilityTurn | ChatStep;

/**
 * What Nina's tool policy says about one capability, in the plain text the model
 * reads. `entry` lists it among the evidence paths, `field` says what its own
 * input field holds, when it has one, and `section` says when to use it and how
 * to fill its input.
 */
const GuidelineSchema = Schema.Struct({
  entry: Schema.String,
  field: Schema.optionalKey(Schema.String),
  section: Schema.String,
});
type Guideline = typeof GuidelineSchema.Type;

/** What a run hands back: the text Nina reads and, when it fell short, how. */
type CapabilityResult = Pick<CapabilityOutput, "text" | "outcome">;

/**
 * The routing facts of a failed run: the gateway's classification of a model
 * call, the phase that failed, and whether the provider's answer was rejected.
 * They are logged and never reach Nina or the learner.
 */
const FailureFacts = Schema.Struct({
  gateway: Schema.optional(GatewayFailure),
  phase: Schema.optional(Schema.String),
  rejected: Schema.optional(Schema.Boolean),
});

/** A run that left nothing usable. Nina and the learner only get `text`. */
class CapabilityFailure extends Schema.TaggedError<CapabilityFailure>()(
  "CapabilityFailure",
  { facts: FailureFacts, text: Schema.String }
) {}

/**
 * Ends a run that left nothing usable. The log gets the routing facts of what
 * failed, never a provider message or a prompt; Nina and the learner only get
 * `text`.
 */
export function failed(facts: typeof FailureFacts.Type, text: string) {
  return Effect.fail(new CapabilityFailure({ facts, text }));
}

/**
 * One capability of Nina, defined once. The shared runner builds its tool from
 * this, so a capability states only what is its own:
 *
 * - `description` is what the model reads in the tool list, `input` is the
 *   Schema of a call, and `guideline` is its part of the tool policy.
 * - `offered` decides from the turn's context whether Nina is offered the tool
 *   and whether a call may run. It has no default, so no capability is allowed
 *   by omission.
 * - `run` does the work, and is told its input, the facts of the turn, and its
 *   call. Its typed errors end as a refusal (`CapabilityDenied`) or as a
 *   failure (`failed`); any other it handles itself.
 * - `continuation` tells the model how to ask for what a truncated answer
 *   omitted.
 * - `note` keeps the answer out of the conversation: the turn holds the text of
 *   a plain answer for the model's next step, and the conversation stores the
 *   note in its place. Answers that state an outcome are fixed lines and stay.
 *
 * A capability that publishes no card is not declared here. Its name is picked
 * in `TextOnlyCapabilitySchema` (`capability/spec.ts`), because the page reads
 * that fact too: a run of it without a card is not empty.
 */
interface CapabilitySpec<Input, Requirements extends RunServices> {
  readonly continuation: string;
  readonly description: string;
  readonly guideline: Guideline;
  readonly input: FlexibleSchema<Input>;
  readonly note?: string;
  readonly offered: (context: OfferContext) => CapabilityDecision;
  readonly run: (
    input: Input,
    call: Omit<CapabilityTurn["Service"], "held"> & {
      readonly messages: ModelMessage[];
      readonly publish: CapabilityProgress;
      readonly toolCallId: string;
    }
  ) => Effect.Effect<
    CapabilityResult,
    CapabilityFailure | CapabilityDenied,
    Requirements
  >;
}

/**
 * A defined capability as the registry lists it. The input type is hidden
 * behind `tool`, so capabilities with different inputs share one record.
 */
export interface Capability {
  readonly guideline: Guideline;
  readonly offered: (context: OfferContext) => CapabilityDecision;
  readonly tool: (
    name: string,
    services: Context.Context<ToolServices>
  ) => Tool;
}

/**
 * Settles one call: the policy decides, the run works under the shared
 * deadline, and every way it can end becomes the result Nina reads. A refusal
 * answers with the denial, a failure is logged as routing facts and answers
 * `failed`, and an answer that must stay out of the conversation is held.
 */
function settle<Input, Requirements extends RunServices>(
  spec: CapabilitySpec<Input, Requirements>,
  name: string,
  input: Input,
  call: Pick<
    Parameters<CapabilitySpec<Input, Requirements>["run"]>[1],
    "messages" | "publish" | "toolCallId"
  >
) {
  return Effect.gen(function* () {
    const { held, ...turn } = yield* CapabilityTurn;
    const decision = spec.offered(turn.context);
    if (decision.state === "denied") {
      return deniedCapabilityResult({
        capability: name,
        reason: decision.reason,
      });
    }
    const result = yield* spec.run(input, { ...turn, ...call }).pipe(
      Effect.catchTags({
        CapabilityDenied: ({ reason }) =>
          Effect.succeed(deniedCapabilityResult({ capability: name, reason })),
        CapabilityFailure: ({ facts, text }) =>
          Effect.as(
            Effect.logWarning("Nina capability failed", {
              capability: name,
              phase: facts.phase,
              reason: facts.gateway?.reason,
              rejected: facts.rejected,
              status: facts.gateway?.status,
              type: facts.gateway?.type,
            }),
            { outcome: "failed" as const, text }
          ),
      })
    );
    if (spec.note === undefined || result.outcome !== undefined) {
      return result;
    }
    MutableHashMap.set(
      held,
      { toolCallId: call.toolCallId, toolName: name },
      result.text
    );
    return { text: spec.note };
  });
}

/**
 * Defines a capability. The tool it builds streams each card its run publishes,
 * keeps the run inside the deadline of its chat step, and settles how the run
 * ended, the same way for every capability.
 */
export function defineCapability<Input, Requirements extends RunServices>(
  spec: CapabilitySpec<Input, Requirements>
): Capability {
  return {
    guideline: spec.guideline,
    offered: spec.offered,
    tool: (name, services) =>
      createTool({
        description: spec.description,
        inputSchema: spec.input,
        outputSchema,
        execute: (_ctx, input, { abortSignal, messages, toolCallId }) =>
          Stream.toAsyncIterableWith(
            streamCapability(
              (publish) =>
                settle(spec, name, input, { messages, publish, toolCallId }),
              {
                capability: name,
                continuation: spec.continuation,
                signal: abortSignal,
              }
            ),
            services
          ),
      }),
  };
}

/**
 * Builds the tool of every capability in a registry for the turn that provides
 * `CapabilityTurn` and `ChatStep`, under the same key: the tool a capability is
 * called by is the name it is listed under. Agent tools own progressive
 * evidence; no HTTP writer or persistence adapter.
 */
export const createCapabilities = Effect.fn("nina.capabilities")(function* <
  Name extends string,
>(registry: Rec.ReadonlyRecord<Name, Capability>) {
  const services = yield* Effect.context<ToolServices>();
  return Rec.map(registry, (capability, name) =>
    capability.tool(name, services)
  );
});
