import { afterEach, describe, expect, it } from "@effect/vitest";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { compute } from "@repo/backend/confect/nina/math/tools/compute";
import { provider } from "@repo/backend/test/gateway";
import { ninaUsage } from "@repo/backend/test/nina";
import {
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
import { ConfigProvider, Effect, Schema } from "effect";

vi.mock("@repo/backend/confect/nina/math/tools/compute", () => ({
  compute: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
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
    const input: typeof MathAlgebraInputSchema.Type = {
      operation: "simplify",
      expression: "x + x",
    };
    const usageHandler = vi.fn();
    const model = new MockLanguageModelV4({
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
    provider.languageModel.mockReturnValue(model);
    vi.mocked(compute).mockReturnValue(Effect.succeed("2x"));
    const result = await runSpecialist((userId) =>
      runMathAgent({
        ...specialistRequest,
        userId,
        task: "Simplify x + x",
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
    expect(result.text).toBe("The checked result is 2x.");
    expect(compute).toHaveBeenCalledWith(
      expect.objectContaining({ input, toolCallId: "repair" })
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
});
