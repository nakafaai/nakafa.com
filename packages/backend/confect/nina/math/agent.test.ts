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
const casConfig = ConfigProvider.fromUnknown({
  NEXT_PUBLIC_CAS_URL: "https://math.example.invalid",
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
              NEXT_PUBLIC_CAS_URL: "https://math.example.invalid",
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

  it("answers a derivative and its value in three model calls: the derivative, its value, and the answer", async () => {
    const derivative: typeof MathCalculusInputSchema.Type = {
      operation: "differentiate",
      expression: "x^3 * sin(x)",
    };
    const value: typeof MathArithmeticInputSchema.Type = {
      operation: "evaluate",
      expression: "3 * (pi / 2)^2 * sin(pi / 2)",
    };
    const model = new MockLanguageModelV4({
      doGenerate: [
        providerStep(
          [
            {
              type: "tool-call",
              toolCallId: "derivative",
              toolName: "calculus",
              input: Schema.encodeSync(
                Schema.fromJsonString(MathCalculusInputSchema)
              )(derivative),
            },
          ],
          "tool-calls"
        ),
        providerStep(
          [
            {
              type: "tool-call",
              toolCallId: "value",
              toolName: "arithmetic",
              input: Schema.encodeSync(
                Schema.fromJsonString(MathArithmeticInputSchema)
              )(value),
            },
          ],
          "tool-calls"
        ),
        providerStep([{ type: "text", text: "The value is 3 pi^2 / 4." }]),
      ],
    });
    provider.languageModel.mockReturnValue(model);
    vi.mocked(compute)
      .mockReturnValueOnce(Effect.succeed("The derivative is checked."))
      .mockReturnValueOnce(Effect.succeed("The value is checked."));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: "What is the derivative of x^3 sin x, and what is its value at x = pi / 2?",
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    expect(result).toEqual({ text: "The value is 3 pi^2 / 4." });
    expect(model.doGenerateCalls).toHaveLength(3);
    expect(model.doGenerateCalls[0]?.toolChoice).toEqual({ type: "required" });
    expect(
      Arr.map(vi.mocked(compute).mock.calls, ([call]) => call.input)
    ).toEqual([derivative, value]);
  });

  it("ends a run that keeps checking with its answer, since the last step may call no tool", async () => {
    const expansion: typeof MathSeriesInputSchema.Type = {
      operation: "series",
      expression: "x^3 * sin(x)",
    };
    const checking = providerStep(
      [
        {
          type: "tool-call",
          toolCallId: "expansion",
          toolName: "series",
          input: Schema.encodeSync(
            Schema.fromJsonString(MathSeriesInputSchema)
          )(expansion),
        },
      ],
      "tool-calls"
    );
    const model = new MockLanguageModelV4({
      doGenerate: [
        ...Arr.makeBy(MATH_STEPS - 1, () => checking),
        providerStep([{ type: "text", text: "The checked answer." }]),
      ],
    });
    provider.languageModel.mockReturnValue(model);
    vi.mocked(compute).mockReturnValue(Effect.succeed("The expansion."));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        publish: () => Effect.void,
        usageHandler: vi.fn(),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, casConfig))
    );
    expect(result).toEqual({ text: "The checked answer." });
    expect(model.doGenerateCalls).toHaveLength(MATH_STEPS);
    expect(compute).toHaveBeenCalledTimes(MATH_STEPS - 1);
    // Only the last call is told to write, and it is the only one.
    expect(
      Arr.map(model.doGenerateCalls, (call) => call.toolChoice?.type === "none")
    ).toEqual(Arr.makeBy(MATH_STEPS, (step) => step === MATH_STEPS - 1));
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
