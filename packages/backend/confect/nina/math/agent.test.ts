import { Agent } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { MATH_STEPS } from "@repo/backend/confect/nina/math/step";
import { compute } from "@repo/backend/confect/nina/math/tools/compute";
import { provider } from "@repo/backend/test/gateway";
import { ninaUsage } from "@repo/backend/test/nina";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import {
  providerStep,
  runSpecialist,
  specialistRequest,
} from "@repo/backend/test/nina/specialist";
import { MathAlgebraInputSchema } from "@repo/math/schema/tool/algebra";
import { MathArithmeticInputSchema } from "@repo/math/schema/tool/arithmetic";
import { MathCalculusInputSchema } from "@repo/math/schema/tool/calculus";
import { MathDiscreteInputSchema } from "@repo/math/schema/tool/discrete";
import { MathEquationInputSchema } from "@repo/math/schema/tool/equation";
import { MathGeometryInputSchema } from "@repo/math/schema/tool/geometry";
import { MathMatrixInputSchema } from "@repo/math/schema/tool/matrix";
import { MathProbabilityInputSchema } from "@repo/math/schema/tool/probability";
import { MathSeriesInputSchema } from "@repo/math/schema/tool/series";
import { MathStatisticsInputSchema } from "@repo/math/schema/tool/statistics";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, ConfigProvider, Effect, Schema } from "effect";

vi.mock("@repo/backend/confect/nina/math/tools/compute", () => ({
  compute: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(compute).mockReset();
  provider.languageModel.mockReset();
});

/** Pairs a tool name with the contract its production tool decodes, checking the fixture against that contract. */
function toolCase<S extends Schema.Top>(
  toolName: string,
  contract: S,
  input: S["Type"]
): [string, S, S["Type"]] {
  return [toolName, contract, input];
}

const cases = [
  toolCase("algebra", MathAlgebraInputSchema, {
    operation: "simplify",
    expression: "x + x",
  }),
  toolCase("arithmetic", MathArithmeticInputSchema, {
    operation: "evaluate",
    expression: "2 + 2",
  }),
  toolCase("calculus", MathCalculusInputSchema, {
    operation: "differentiate",
    expression: "x^2",
  }),
  toolCase("discrete", MathDiscreteInputSchema, {
    operation: "gcd",
    values: ["84", "30"],
  }),
  toolCase("equation", MathEquationInputSchema, {
    operation: "solve",
    expression: "x + 1 = 2",
  }),
  toolCase("geometry", MathGeometryInputSchema, {
    operation: "distance",
    points: [
      { x: "0", y: "0" },
      { x: "3", y: "4" },
    ],
  }),
  toolCase("matrix", MathMatrixInputSchema, {
    operation: "determinant",
    matrix: [
      ["1", "0"],
      ["0", "1"],
    ],
  }),
  toolCase("probability", MathProbabilityInputSchema, {
    operation: "distribution",
    distribution: "bernoulli",
    parameters: { p: "0.5" },
  }),
  toolCase("series", MathSeriesInputSchema, {
    operation: "series",
    expression: "exp(x)",
  }),
  toolCase("statistics", MathStatisticsInputSchema, {
    operation: "mean",
    values: ["1", "2", "3"],
  }),
];

const repairedInput: typeof MathAlgebraInputSchema.Type = {
  operation: "simplify",
  expression: "x + x",
};
/** The cut answer, then the note that tells Nina it was cut short. */
const cutResult = /^The checked result is 2\n\n.*cut short/su;
/** The note that tells Nina the run ended at its step limit. */
const cutAtLimit = /step limit/u;

const derivativeQuestion =
  "What is the derivative of x^3 sin x, and what is its value at x = pi / 2?";
/** The check the question asks for, then the one its value needs from it. */
const derivative: typeof MathCalculusInputSchema.Type = {
  operation: "differentiate",
  expression: "x^3 * sin(x)",
};
const value: typeof MathArithmeticInputSchema.Type = {
  operation: "evaluate",
  expression: "3 * (pi / 2)^2 * sin(pi / 2)",
};
/** The check that was seen on production and that nobody had asked for. */
const expansion: typeof MathSeriesInputSchema.Type = {
  operation: "series",
  expression: "x^3 * sin(x)",
};

/** A model step that calls one tool with `input`, typed by that tool's contract. */
function callStep(toolName: string, input: object, toolCallId: string) {
  return providerStep(
    [{ type: "tool-call", toolCallId, toolName, input: encodeJsonText(input) }],
    "tool-calls"
  );
}

const casConfig = ConfigProvider.fromUnknown({
  VITE_CAS_URL: "https://math.example.invalid",
  MATH_CAS_API_KEY: "test",
});

/**
 * A model that first calls `algebra` without its expression, then writes the
 * repaired arguments `input` when asked to repair them, then answers.
 */
function repairScript(input: typeof MathAlgebraInputSchema.Type) {
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          {
            type: "tool-call",
            toolCallId: "repair",
            toolName: "algebra",
            input: '{"operation":"simplify"}',
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool-calls" },
        usage: ninaUsage,
        warnings: [],
      },
      {
        content: [
          {
            type: "text",
            text: Schema.encodeSync(
              Schema.fromJsonString(MathAlgebraInputSchema)
            )(input),
          },
        ],
        finishReason: { unified: "stop", raw: "stop" },
        usage: ninaUsage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "The checked result is 2x." }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: ninaUsage,
        warnings: [],
      },
    ],
  });
}

describe("math Agent execution", () => {
  it("rejects missing CAS configuration before spending tokens on unexecutable tools", async () => {
    const model = new MockLanguageModelV4();
    provider.languageModel.mockReturnValue(model);
    const failure = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        ),
        Effect.flip,
        Effect.map((error) => error._tag)
      )
    );
    expect(failure).toBe("MathGenerationError");
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(compute).not.toHaveBeenCalled();
  });
  it.each(cases)(
    "validates and computes %s through the Agent tool boundary",
    async (toolName, contract, input) => {
      const usageHandler = vi.fn();
      const model = new MockLanguageModelV4({
        doGenerate: [
          {
            content: [
              {
                type: "tool-call",
                toolCallId: "calculation",
                toolName,
                input: Schema.encodeSync(Schema.fromJsonString(contract))(
                  input
                ),
              },
            ],
            finishReason: { unified: "tool-calls", raw: "tool-calls" },
            usage: ninaUsage,
            warnings: [],
          },
          {
            content: [{ type: "text", text: "Verified calculation." }],
            finishReason: { unified: "stop", raw: "stop" },
            usage: ninaUsage,
            warnings: [],
          },
        ],
      });
      provider.languageModel.mockReturnValue(model);
      vi.mocked(compute).mockReturnValue(
        Effect.succeed("Deterministic evidence.")
      );
      const result = await runSpecialist((userId) =>
        runMathAgent({
          ...specialistRequest,
          userId,
          publish: () => Effect.void,
          usageHandler,
        }).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              VITE_CAS_URL: "https://math.example.invalid",
              MATH_CAS_API_KEY: "test",
            })
          )
        )
      );
      expect(result).toEqual({ text: "Verified calculation." });
      expect(compute).toHaveBeenCalledWith(
        expect.objectContaining({ input, toolCallId: "calculation" })
      );
      expect(usageHandler).toHaveBeenCalledTimes(2);
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(encodeJsonText(model.doGenerateCalls[1]?.prompt)).toContain(
        "Deterministic evidence."
      );
    }
  );

  it("writes the answer to a derivative and its value in its last step, which may call no tool, although the model went on to an expansion nobody asked for", async () => {
    // The checks the question needs, then the one it does not.
    const checks = [
      callStep("calculus", derivative, "derivative"),
      callStep("arithmetic", value, "value"),
      ...Arr.makeBy(MATH_STEPS - 3, (step) =>
        callStep("series", expansion, `expansion-${step}`)
      ),
    ];
    const model = new MockLanguageModelV4({
      doGenerate: [
        ...checks,
        providerStep([{ type: "text", text: "The value is 3 pi^2 / 4." }]),
      ],
    });
    provider.languageModel.mockReturnValue(model);
    vi.mocked(compute).mockReturnValue(Effect.succeed("It is checked."));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: derivativeQuestion,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    // Using every step is no shortfall: the last one is where a run that has
    // checked all it needs writes its answer too, so the report is a plain one.
    expect(result).toEqual({ text: "The value is 3 pi^2 / 4." });
    expect(model.doGenerateCalls).toHaveLength(MATH_STEPS);
    expect(
      Arr.map(vi.mocked(compute).mock.calls, ([call]) => call.input)
    ).toEqual([
      derivative,
      value,
      ...Arr.makeBy(MATH_STEPS - 3, () => expansion),
    ]);
    // The first step must call a tool, the last may call none, and the steps
    // between them choose freely.
    expect(Arr.map(model.doGenerateCalls, (call) => call.toolChoice)).toEqual([
      { type: "required" },
      ...Arr.makeBy(MATH_STEPS - 2, () => ({ type: "auto" })),
      { type: "none" },
    ]);
  });

  it("cuts a model that still asks for a tool in its last step at the step limit, and reports the run as partial", async () => {
    // One more check than the run has steps for. A provider that ignored the
    // last step's rule would answer with a tool call, and the loop would go on.
    const model = new MockLanguageModelV4({
      doGenerate: [
        callStep("calculus", derivative, "derivative"),
        callStep("arithmetic", value, "value"),
        ...Arr.makeBy(MATH_STEPS - 1, (step) =>
          callStep("series", expansion, `expansion-${step}`)
        ),
      ],
    });
    provider.languageModel.mockReturnValue(model);
    vi.mocked(compute).mockReturnValue(Effect.succeed("It is checked."));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: derivativeQuestion,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    expect(model.doGenerateCalls).toHaveLength(MATH_STEPS);
    expect(compute).toHaveBeenCalledTimes(MATH_STEPS);
    // No answer was written, so Nina is told the run was cut, not handed an
    // empty result as a whole one.
    expect(result).toEqual({
      outcome: "partial",
      text: expect.stringMatching(cutAtLimit),
    });
  });

  it("hands Nina a cut answer as partial, and says it was cut short, when its last step ended at the output cap", async () => {
    vi.mocked(compute).mockReturnValue(Effect.succeed("2x"));
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: [
          providerStep(
            [
              {
                type: "tool-call",
                toolCallId: "calculation",
                toolName: "algebra",
                input: Schema.encodeSync(
                  Schema.fromJsonString(MathAlgebraInputSchema)
                )(repairedInput),
              },
            ],
            "tool-calls"
          ),
          providerStep(
            [{ type: "text", text: "The checked result is 2" }],
            "length"
          ),
        ],
      })
    );
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    expect(result).toEqual({
      outcome: "partial",
      text: expect.stringMatching(cutResult),
    });
  });

  it("keeps provider failure typed at the specialist boundary", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: () => Promise.reject(new Error("provider rejected")),
      })
    );
    const error = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.flip,
        Effect.map(({ _tag, message }) => ({ _tag, message }))
      )
    );
    expect(error).toMatchObject({
      _tag: "MathGenerationError",
      message: "Math generation failed.",
    });
  });

  it("repairs missing arguments through Agent before executing the requested calculation", async () => {
    const usageHandler = vi.fn();
    provider.languageModel.mockReturnValue(repairScript(repairedInput));
    vi.mocked(compute).mockReturnValue(Effect.succeed("2x"));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: "Simplify x + x",
        publish: () => Effect.void,
        usageHandler,
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    expect(result.text).toBe("The checked result is 2x.");
    expect(compute).toHaveBeenCalledWith(
      expect.objectContaining({ input: repairedInput, toolCallId: "repair" })
    );
    expect(usageHandler).toHaveBeenCalledTimes(3);
    expect(usageHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agentName: "math-repair",
        userId: expect.any(String),
      })
    );
  });

  it("ends a repair call that is in flight when the run is stopped, so a stopped turn spends no more on the background model", async () => {
    let started: () => void = () => undefined;
    const repairing = new Promise<void>((resolve) => {
      started = resolve;
    });
    let repair: Promise<never> | undefined;
    // The first call writes a tool call that fails its schema, so the SDK asks
    // for a repair. The repair call never answers: only its signal can end it.
    const model: MockLanguageModelV4 = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) => {
        if (model.doGenerateCalls.length === 1) {
          return Promise.resolve(
            callStep("algebra", { operation: "simplify" }, "repair")
          );
        }
        repair = new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener("abort", () =>
            reject(abortSignal.reason)
          );
        });
        started();
        return repair;
      },
    });
    provider.languageModel.mockReturnValue(model);
    await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, casConfig),
        // A stop interrupts the run once its repair is in flight, as the
        // capability stream does when its turn is stopped.
        Effect.raceFirst(Effect.promise(() => repairing))
      )
    );

    // The repair call ended with the stop, and no call followed it.
    await expect(repair).rejects.toMatchObject({ name: "AbortError" });
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(compute).not.toHaveBeenCalled();
  });

  it("cuts its model call and its repair call to the time the capability has left", async () => {
    provider.languageModel.mockReturnValue(repairScript(repairedInput));
    vi.mocked(compute).mockReturnValue(Effect.succeed("2x"));
    const generate = vi.spyOn(Agent.prototype, "generateText");
    await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: "Simplify x + x",
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, casConfig),
        withTimeLeft("7 seconds")
      )
    );
    // The first call is the specialist loop; the second is its repair.
    expect(Arr.map(generate.mock.calls, ([, , call]) => call.timeout)).toEqual([
      { stepMs: 7000, totalMs: 7000 },
      { stepMs: 7000, totalMs: 7000 },
    ]);
  });
});
