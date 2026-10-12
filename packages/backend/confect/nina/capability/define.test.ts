import { afterEach, describe, expect, it } from "@effect/vitest";
import { ChatStep } from "@repo/backend/confect/nina/capability/deadline";
import {
  type Capability,
  defineCapability,
  failed,
} from "@repo/backend/confect/nina/capability/define";
import type { Held } from "@repo/backend/confect/nina/capability/held";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  ALLOWED,
  CapabilityDenied,
  denied,
} from "@repo/backend/confect/nina/policy/capability";
import { done, loading } from "@repo/backend/test/nina/artifact";
import {
  finalAnswer,
  playTurn,
  streamedToolCall,
  streamTurn,
  toolCall,
} from "@repo/backend/test/nina/capability";
import {
  openHomeSession,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { MockLanguageModelV4 } from "ai/test";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableRef,
  Option,
  Schema,
} from "effect";

afterEach(() => vi.restoreAllMocks());

/**
 * These tests define a capability that exists only here, `probe`, and play it
 * through the real Agent. Nothing but this file knows it: the policy check, the
 * denial answer, the progress rows, the deadline and the settled outcome all
 * come from `defineCapability` and `createCapabilities`.
 */
const topic = { topic: "limits" };

/** What every probe says of itself; each test gives the probe its own `run`. */
const probe = {
  continuation: "Ask the probe again.",
  description: "A capability that exists only in this test.",
  guideline: { entry: "probe: a throwaway.", section: "## probe" },
  input: createEffectSchema(Schema.Struct({ topic: Schema.NonEmptyString })),
  offered: () => ALLOWED,
} as const;

/** Plays a model that calls the probe once, in a turn that has Nina's context pack unless `pack` is false. */
function askProbe(
  capability: Capability,
  {
    chatStep,
    held,
    pack = true,
  }: {
    readonly chatStep?: Parameters<typeof playTurn>[0]["chatStep"];
    readonly held?: Held;
    readonly pack?: boolean;
  } = {}
) {
  const model = new MockLanguageModelV4({
    doGenerate: [toolCall("probe", topic), finalAnswer],
  });
  return runSpecialist((userId) =>
    Effect.gen(function* () {
      const session = yield* openHomeSession;
      return yield* playTurn({
        ...(chatStep === undefined ? {} : { chatStep }),
        context: {
          ...specialistRequest.context,
          nina: pack ? session.context : undefined,
        },
        ...(held === undefined ? {} : { held }),
        model,
        prompt: "Use the probe.",
        registry: { probe: capability },
        userId,
      });
    })
  );
}

describe("a capability that exists only in a test", () => {
  describe("gets the policy check and the denial answer", () => {
    it("answers a call that the policy refuses with the denial, and never runs it", async () => {
      const run = vi.fn(() => Effect.succeed({ text: "Never read." }));
      const { logged, result } = await askProbe(
        defineCapability({
          ...probe,
          offered: () => denied("The probe is closed today."),
          run,
        })
      );

      expect(run).not.toHaveBeenCalled();
      expect(result).toMatchObject([
        {
          artifacts: [],
          outcome: "denied",
          text: expect.stringContaining("- Capability: probe"),
        },
      ]);
      expect(result[0]).toMatchObject({
        text: expect.stringContaining("- Reason: The probe is closed today."),
      });
      expect(MutableRef.get(logged)).toEqual([]);
    });

    it("answers a call whose run refuses it later in the same way", async () => {
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          run: () =>
            Effect.fail(
              new CapabilityDenied({ reason: "Conditions changed." })
            ),
        })
      );

      expect(result).toMatchObject([
        {
          outcome: "denied",
          text: expect.stringContaining("- Reason: Conditions changed."),
        },
      ]);
    });

    it("allows nothing in a turn that has no context pack", async () => {
      const run = vi.fn(() => Effect.succeed({ text: "Never read." }));
      const { result } = await askProbe(defineCapability({ ...probe, run }), {
        pack: false,
      });

      expect(run).not.toHaveBeenCalled();
      expect(result).toMatchObject([
        {
          outcome: "denied",
          text: expect.stringContaining(
            "Nina context is unavailable for this turn."
          ),
        },
      ]);
    });
  });

  describe("gets the failure classification", () => {
    it("ends a failed run as failed, and logs its routing facts and never its text", async () => {
      const { logged, result } = await askProbe(
        defineCapability({
          ...probe,
          run: () =>
            failed(
              { phase: "lookup", rejected: true },
              "The probe could not look it up."
            ),
        })
      );

      expect(result).toMatchObject([
        { outcome: "failed", text: "The probe could not look it up." },
      ]);
      expect(MutableRef.get(logged)).toEqual([
        [
          "Nina capability failed",
          expect.objectContaining({
            capability: "probe",
            phase: "lookup",
            rejected: true,
          }),
        ],
      ]);
    });
  });

  describe("gets the settled outcome", () => {
    it("reads a run that gathered no card, and states no outcome, as empty", async () => {
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          run: () => Effect.succeed({ text: "Found nothing." }),
        })
      );

      expect(result).toMatchObject([
        { artifacts: [], outcome: "empty", text: "Found nothing." },
      ]);
    });

    it("reads a run that gathered a card as done", async () => {
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          run: (_input, { publish }) =>
            Effect.as(publish(done), { text: "Verified." }),
        })
      );

      expect(result).toEqual([{ artifacts: [done], text: "Verified." }]);
    });

    it("reads a text-only run as done, because its answer is the text", async () => {
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          run: () => Effect.succeed({ text: "Told in words." }),
          textOnly: true,
        })
      );

      expect(result).toEqual([{ artifacts: [], text: "Told in words." }]);
    });
  });

  describe("gets the progress rows", () => {
    it("streams the cards its run publishes before the run ends, and ends with all of them", async () => {
      const model = new MockLanguageModelV4({
        doStream: streamedToolCall("probe", topic),
      });
      const capability = defineCapability({
        ...probe,
        run: (_input, { publish }) =>
          Effect.gen(function* () {
            yield* publish(loading);
            // The consumer reads the card while the run still works.
            yield* Effect.sleep("100 millis");
            yield* publish(done);
            return { text: "Verified." };
          }),
      });
      const outputs = await runSpecialist((userId) =>
        Effect.gen(function* () {
          const session = yield* openHomeSession;
          return yield* streamTurn({
            context: { ...specialistRequest.context, nina: session.context },
            model,
            prompt: "Use the probe.",
            registry: { probe: capability },
            userId,
          });
        })
      );

      expect(outputs[0]).toMatchObject({
        final: false,
        output: { artifacts: [loading], text: "" },
      });
      expect(Arr.last(outputs)).toEqual(
        Option.some({
          final: true,
          output: { artifacts: [done], text: "Verified." },
        })
      );
    });
  });

  describe("gets the deadline", () => {
    it("never starts a run whose chat step has no time left, and answers that it ran out of time", async () => {
      const run = vi.fn(() => Effect.succeed({ text: "Never read." }));
      const { logged, result } = await askProbe(
        defineCapability({ ...probe, run }),
        {
          // The step began at the start of the clock, so its time is long gone.
          chatStep: Effect.provideService(ChatStep, {
            startedAt: Effect.succeed(0),
            turnStartedAt: 0,
          }),
        }
      );

      expect(run).not.toHaveBeenCalled();
      expect(result).toMatchObject([
        { outcome: "failed", text: expect.stringContaining("ran out of time") },
      ]);
      expect(MutableRef.get(logged)).toEqual([
        ["Nina capability ran out of time", { capability: "probe" }],
      ]);
    });
  });

  describe("keeps its answer out of the conversation when it declares a note", () => {
    it("stores the note and holds the words for the next step of the turn", async () => {
      const held: Held = MutableHashMap.empty();
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          note: "The words are not kept.",
          run: () => Effect.succeed({ text: "Private words." }),
          textOnly: true,
        }),
        { held }
      );

      expect(result).toEqual([
        { artifacts: [], text: "The words are not kept." },
      ]);
      expect(
        MutableHashMap.get(held, {
          toolCallId: "capability",
          toolName: "probe",
        })
      ).toEqual(Option.some("Private words."));
    });

    it("stores an answer that states an outcome as it is, and holds nothing", async () => {
      const held: Held = MutableHashMap.empty();
      const { result } = await askProbe(
        defineCapability({
          ...probe,
          note: "The words are not kept.",
          run: () =>
            Effect.succeed({ outcome: "empty", text: "Nothing saved." }),
          textOnly: true,
        }),
        { held }
      );

      expect(result).toEqual([
        { artifacts: [], outcome: "empty", text: "Nothing saved." },
      ]);
      expect(MutableHashMap.size(held)).toBe(0);
    });
  });
});
