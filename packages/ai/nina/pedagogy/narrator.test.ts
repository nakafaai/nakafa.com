import {
  LanguageModelProvider,
  LanguageModelProviderError,
} from "@repo/ai/config/language/service";
import { ModelIdSchema } from "@repo/ai/config/model";
import {
  PedagogyNarrationError,
  PedagogyNarrator,
} from "@repo/ai/nina/pedagogy/narrator";
import type { MathWorkResultShape } from "@repo/math/schema/work";
import { MockLanguageModelV3 } from "ai/test";
import { Cause, type Context, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const generateText = vi.hoisted(() => vi.fn());
const modelId = ModelIdSchema.make("nakafa-lite");
const model = new MockLanguageModelV3({
  modelId: "google/gemini-3-flash",
});
const EVIDENCE_HASH_PATTERN = /^evidence:/u;

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    generateText,
  };
});

afterEach(() => {
  generateText.mockReset();
});

describe("PedagogyNarrator", () => {
  it("generates a typed live projection from allowed MathWork refs", async () => {
    generateText.mockResolvedValue({
      output: {
        sentences: [
          {
            evidenceRefs: ["math:solve:narrator:step:0"],
            text: "Langkah ini menunjukkan persamaan berubah menjadi dua kemungkinan nilai $x$.",
          },
        ],
      },
    });

    const projection = await Effect.runPromise(
      PedagogyNarrator.narrate({
        locale: "id",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        output: expect.objectContaining({
          name: "object",
        }),
        stopWhen: expect.any(Function),
      })
    );
    expect(projection).toMatchObject({
      evidenceHash: expect.stringMatching(EVIDENCE_HASH_PATTERN),
      kind: "math-pedagogy-projection",
      model: {
        gatewayModelId: "google/gemini-3-flash",
        modelId: "nakafa-lite",
        promptVersion: "math.pedagogy.v1",
        provider: "ai-gateway",
        schemaVersion: "pedagogy.projection.v1",
      },
      sentences: [
        {
          evidenceRefs: ["math:solve:narrator:step:0"],
          id: "math:solve:narrator:pedagogy:0",
        },
      ],
      workId: "math:solve:narrator",
    });
  });

  it("fails typed when model narration cites unknown evidence", async () => {
    generateText.mockResolvedValue(
      validDraft("This sentence is not backed by the packet.", [
        "math:solve:narrator:invented",
      ])
    );

    const exit = await Effect.runPromiseExit(
      PedagogyNarrator.narrate({
        locale: "en",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit)
      ? Cause.failureOption(exit.cause)
      : Option.none();
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toBeInstanceOf(PedagogyNarrationError);
      expect(failure.value.source).toBe("pedagogy.refs");
    }
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("repairs invalid structured output before returning narration", async () => {
    generateText
      .mockResolvedValueOnce({ output: { sentences: [] } })
      .mockResolvedValueOnce(validDraft("Gunakan jawaban $x=2$ dari kartu."));

    const projection = await Effect.runPromise(
      PedagogyNarrator.narrate({
        locale: "id",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("Repair the previous"),
          }),
        ],
      })
    );
    expect(projection.sentences[0]?.text).toBe(
      "Gunakan jawaban $x=2$ dari kartu."
    );
  });

  it("repairs thrown structured-output failures before returning narration", async () => {
    generateText
      .mockRejectedValueOnce(new Error("No object generated."))
      .mockResolvedValueOnce(validDraft("Gunakan jawaban $x=2$ dari kartu."));

    const projection = await Effect.runPromise(
      PedagogyNarrator.narrate({
        locale: "id",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(projection.sentences[0]?.text).toBe(
      "Gunakan jawaban $x=2$ dari kartu."
    );
  });

  it("repairs invalid evidence refs before returning narration", async () => {
    generateText
      .mockResolvedValueOnce(
        validDraft("Gunakan jawaban $x=2$ dari kartu.", [
          "math:solve:narrator:invented",
        ])
      )
      .mockResolvedValueOnce(validDraft("Gunakan jawaban $x=2$ dari kartu."));

    const projection = await Effect.runPromise(
      PedagogyNarrator.narrate({
        locale: "id",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(projection.sentences[0]?.evidenceRefs).toEqual([
      "math:solve:narrator:step:0",
    ]);
  });

  it("repairs raw math narration before returning Markdown LaTeX", async () => {
    generateText
      .mockResolvedValueOnce(validDraft("Hasil akhirnya adalah x = 2."))
      .mockResolvedValueOnce(validDraft("Hasil akhirnya adalah $x=2$."));

    const projection = await Effect.runPromise(
      PedagogyNarrator.narrate({
        locale: "id",
        modelId,
        result: mathWorkFixture(),
      }).pipe(
        Effect.provide(PedagogyNarrator.Default),
        Effect.provideService(LanguageModelProvider, {
          resolve: () => Effect.succeed(model),
        })
      )
    );

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(projection.sentences[0]?.text).toBe("Hasil akhirnya adalah $x=2$.");
  });

  it.each([
    ["heading block", "# Langkah penyelesaian"],
    ["raw equality", "Hasil akhirnya adalah x = 2."],
    ["raw CAS", "Hasil CAS adalah Eq(x**2, 4)."],
    ["raw product", "Faktorkan (x - 2)*(x + 2)."],
  ])("fails typed when model returns %s", async (_caseName, text) => {
    generateText.mockResolvedValue(validDraft(text));

    const exit = await runNarrationExit({
      locale: "id",
      modelId,
      result: mathWorkFixture(),
    });

    expectPedagogyFailureSource(exit, "pedagogy.output");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("fails typed when narration input does not match the schema", async () => {
    const exit = await runNarrationExit({
      locale: "",
      modelId,
      result: mathWorkFixture(),
    });

    expectPedagogyFailureSource(exit, "pedagogy.input");
  });

  it("maps model-provider failures into the narrator error channel", async () => {
    const exit = await runNarrationExit(
      {
        locale: "en",
        modelId,
        result: mathWorkFixture(),
      },
      {
        resolve: () =>
          Effect.fail(
            new LanguageModelProviderError({
              message: "Configured model is unavailable.",
              source: "ai.model",
            })
          ),
      }
    );

    expectPedagogyFailureSource(exit, "ai.model");
  });

  it.each([
    [new Error("SDK object failure."), "SDK object failure."],
    ["SDK string failure.", "SDK string failure."],
    [undefined, "Pedagogy narration failed."],
  ])("maps generation failure diagnostics", async (error, message) => {
    generateText.mockRejectedValue(error);

    const exit = await runNarrationExit({
      locale: "en",
      modelId,
      result: mathWorkFixture(),
    });

    expectPedagogyFailureSource(exit, "pedagogy.generate", message);
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});

/** Runs the narrator with the default model provider used by these tests. */
function runNarrationExit(
  input: Parameters<typeof PedagogyNarrator.narrate>[0],
  provider: Context.Tag.Service<typeof LanguageModelProvider> = {
    resolve: () => Effect.succeed(model),
  }
) {
  return Effect.runPromiseExit(
    PedagogyNarrator.narrate(input).pipe(
      Effect.provide(PedagogyNarrator.Default),
      Effect.provideService(LanguageModelProvider, provider)
    )
  );
}

/** Asserts that the narrator failed with the expected typed source. */
function expectPedagogyFailureSource(
  exit: Awaited<ReturnType<typeof runNarrationExit>>,
  source: string,
  message?: string
) {
  expect(Exit.isFailure(exit)).toBe(true);
  const failure = Exit.isFailure(exit)
    ? Cause.failureOption(exit.cause)
    : Option.none();
  expect(Option.isSome(failure)).toBe(true);

  if (Option.isNone(failure)) {
    return;
  }

  expect(failure.value).toBeInstanceOf(PedagogyNarrationError);
  expect(failure.value.source).toBe(source);

  if (message) {
    expect(failure.value.message).toBe(message);
  }
}

/** Builds one schema-shaped narration draft for repair-path tests. */
function validDraft(
  text: string,
  evidenceRefs: readonly string[] = ["math:solve:narrator:step:0"]
) {
  return {
    output: {
      sentences: [
        {
          evidenceRefs: [...evidenceRefs],
          text,
        },
      ],
    },
  };
}

/** Builds one compact MathWork result with stable evidence refs. */
function mathWorkFixture(): MathWorkResultShape {
  return {
    artifacts: [],
    steps: [
      {
        input: { expression: "x^2 = 4", latex: "x^2 = 4" },
        order: 0,
        output: { expression: "[-2, 2]", latex: "\\left[-2,2\\right]" },
        projection: stepProjection("math:solve:narrator:step:0"),
        projectionLevels: ["atomic", "school", "advanced", "professor"],
        ruleId: "cas.solve",
        verificationLane: "derived",
        workId: "math:solve:narrator",
      },
    ],
    work: {
      assumptions: [],
      computations: [
        {
          conditions: [],
          input: {
            expression: "x^2 = 4",
            kind: "math",
            operation: "solve",
            variables: ["x"],
          },
          items: [],
          kind: "solve",
          operation: "solve",
          primary: { expression: "x^2 = 4", latex: "x^2 = 4" },
          secondary: {
            expression: "[-2, 2]",
            latex: "\\left[-2,2\\right]",
          },
          stepStatus: "complete",
          steps: [],
          status: "verified",
        },
      ],
      input: {
        givens: ["x^2 = 4"],
        kind: "prompt",
        locale: "id",
        objective: "solve",
        requirements: [],
        text: "solve",
      },
      limitations: [],
      plannedRequest: {
        expression: "x^2 = 4",
        kind: "math",
        operation: "solve",
        variables: ["x"],
      },
      primaryResult: {
        expression: "[-2, 2]",
        latex: "\\left[-2,2\\right]",
      },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.solve",
        values: [
          {
            name: "evidenceRef",
            value: "math:solve:narrator:verification:primary",
          },
        ],
      },
      workId: "math:solve:narrator",
    },
  };
}

/** Builds one projection map that cites the same deterministic step row. */
function stepProjection(ref: string) {
  return {
    advanced: stepCopy(ref),
    atomic: stepCopy(ref),
    professor: stepCopy(ref),
    school: stepCopy(ref),
  };
}

/** Builds one semantic step-copy row with evidence-ref interpolation data. */
function stepCopy(
  ref: string
): MathWorkResultShape["steps"][number]["projection"]["school"] {
  return {
    key: "math-step-solve",
    values: [{ name: "evidenceRef", value: ref }],
  };
}
