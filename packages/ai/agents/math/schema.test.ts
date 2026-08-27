import { describe, expect, it } from "@effect/vitest";
import {
  mathAlgebraInput,
  mathArithmeticInput,
  mathCalculusInput,
  mathDiscreteInput,
  mathEquationInput,
  mathGeometryInput,
  mathMatrixInput,
  mathProbabilityInput,
  mathSeriesInput,
  mathStatisticsInput,
} from "@repo/ai/agents/math/schema";
import { asSchema } from "ai";
import { Effect, Predicate } from "effect";

/** Proves that Effect-backed AI schemas keep their deterministic sync contract. */
function readSynchronous<A>(value: A | PromiseLike<A>, operation: string): A {
  if (Predicate.isPromiseLike(value)) {
    expect.fail(`${operation} must remain synchronous.`);
  }
  return value;
}
/** Awaits one AI SDK validator inside Effect and returns its Vitest matcher. */
function expectValidation<A>(value: A | PromiseLike<A>) {
  return Effect.promise(() => Promise.resolve(value)).pipe(
    Effect.map((result) => expect(result))
  );
}
/** Requires the validator promised by an AI SDK schema adapter. */
function requireValidator<A>(value: A | undefined) {
  return Effect.suspend(() =>
    value === undefined
      ? Effect.die("AI SDK schema adapter omitted its validator.")
      : Effect.succeed(value)
  );
}
describe("math AI input schemas", () => {
  it.effect("exposes Effect schemas as AI SDK-compatible JSON schemas", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathArithmeticInput);
      const jsonSchema = readSynchronous(schema.jsonSchema, "Math JSON Schema");
      const validate = yield* requireValidator(schema.validate);
      expect(jsonSchema).toMatchObject({
        description: "Exact arithmetic tool input.",
        properties: {
          expression: {
            description:
              "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
            type: "string",
          },
          operation: {
            description: "Evaluate an exact arithmetic or numeric expression.",
            enum: ["evaluate"],
            type: "string",
          },
        },
        required: ["expression", "operation"],
        type: "object",
      });
      (yield* expectValidation(
        validate({
          expression: "2 + 2",
          operation: "evaluate",
        })
      )).toEqual({
        success: true,
        value: {
          expression: "2 + 2",
          operation: "evaluate",
        },
      });
      (yield* expectValidation(
        validate({
          expression: "2 + 2",
          operation: "simplify",
        })
      )).toMatchObject({
        success: false,
      });
    })
  );
  it.effect(
    "rejects algebra operations that omit their required expression fields",
    () =>
      Effect.gen(function* () {
        const schema = asSchema(mathAlgebraInput);
        const validate = yield* requireValidator(schema.validate);
        (yield* expectValidation(
          validate({
            operation: "simplify",
          })
        )).toMatchObject({
          success: false,
        });
        (yield* expectValidation(
          validate({
            operation: "domain",
          })
        )).toMatchObject({
          success: false,
        });
        (yield* expectValidation(
          validate({
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          })
        )).toEqual({
          success: true,
          value: {
            expression: "(x^2 - 9)/(x - 3)",
            operation: "simplify",
          },
        });
      })
  );
  it.effect("requires both sides for algebra comparison", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathAlgebraInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          left: "(x^2 - 9)/(x - 3)",
          operation: "compare",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          left: "(x^2 - 9)/(x - 3)",
          operation: "compare",
          right: "x + 3",
        })
      )).toEqual({
        success: true,
        value: {
          left: "(x^2 - 9)/(x - 3)",
          operation: "compare",
          right: "x + 3",
        },
      });
    })
  );
  it.effect("allows equation solve domains for restricted variables", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathEquationInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          expression: "x^x * (ln(x) + 1) = 0",
          lower: "0",
          lowerInclusive: false,
          operation: "solve",
          variable: "x",
        })
      )).toEqual({
        success: true,
        value: {
          expression: "x^x * (ln(x) + 1) = 0",
          lower: "0",
          lowerInclusive: false,
          operation: "solve",
          variable: "x",
        },
      });
    })
  );
  it.effect(
    "allows system solve domains with an explicit bounded variable",
    () =>
      Effect.gen(function* () {
        const schema = asSchema(mathEquationInput);
        const validate = yield* requireValidator(schema.validate);
        (yield* expectValidation(
          validate({
            expressions: ["x^2 - 1 = 0", "y = 0"],
            lower: "0",
            lowerInclusive: false,
            operation: "solve",
            variable: "x",
            variables: ["x", "y"],
          })
        )).toEqual({
          success: true,
          value: {
            expressions: ["x^2 - 1 = 0", "y = 0"],
            lower: "0",
            lowerInclusive: false,
            operation: "solve",
            variable: "x",
            variables: ["x", "y"],
          },
        });
      })
  );
  it.effect("rejects unsupported equation domain shapes", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathEquationInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          expression: "x^2 - 1 = 0",
          lower: "0",
          operation: "roots",
          variable: "x",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          expressions: ["x + y = 3", "y = 1"],
          lower: "0",
          operation: "solve",
          variable: "x",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          expressions: ["x^2 - 1 = 0", "y = 0"],
          lower: "0",
          operation: "solve",
          variable: "z",
          variables: ["x", "y"],
        })
      )).toMatchObject({
        success: false,
      });
    })
  );
  it.effect(
    "requires values for discrete operations that use integer lists",
    () =>
      Effect.gen(function* () {
        const schema = asSchema(mathDiscreteInput);
        const validate = yield* requireValidator(schema.validate);
        (yield* expectValidation(
          validate({
            operation: "gcd",
          })
        )).toMatchObject({
          success: false,
        });
        (yield* expectValidation(
          validate({
            operation: "gcd",
            values: ["84", "30"],
          })
        )).toEqual({
          success: true,
          value: {
            operation: "gcd",
            values: ["84", "30"],
          },
        });
      })
  );
  it.effect("requires the second matrix for matrix multiplication", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathMatrixInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          matrix: [["1"]],
          operation: "matrix_multiply",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          matrix: [["1"]],
          operation: "matrix_multiply",
          right_matrix: [["2"]],
        })
      )).toEqual({
        success: true,
        value: {
          matrix: [["1"]],
          operation: "matrix_multiply",
          right_matrix: [["2"]],
        },
      });
    })
  );
  it.effect("requires a calculus variable for parameterized expressions", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathCalculusInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          expression: "x^(a-1) * exp(-x)",
          lower: "0",
          operation: "integrate",
          upper: "oo",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          expression: "x^(a-1) * exp(-x)",
          lower: "0",
          operation: "integrate",
          upper: "oo",
          variable: "x",
        })
      )).toEqual({
        success: true,
        value: {
          expression: "x^(a-1) * exp(-x)",
          lower: "0",
          operation: "integrate",
          upper: "oo",
          variable: "x",
        },
      });
      (yield* expectValidation(
        validate({
          expression: "x^2",
          operation: "differentiate",
        })
      )).toEqual({
        success: true,
        value: {
          expression: "x^2",
          operation: "differentiate",
        },
      });
      (yield* expectValidation(
        validate({
          expression: "x^x",
          operation: "differentiate",
          order: 2,
          variable: "x",
        })
      )).toEqual({
        success: true,
        value: {
          expression: "x^x",
          operation: "differentiate",
          order: 2,
          variable: "x",
        },
      });
      (yield* expectValidation(
        validate({
          expression: "x^2",
          operation: "integrate",
          order: 2,
          variable: "x",
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          expression: "sin(x) / x",
          operation: "limit",
          order: 2,
          point: "0",
          variable: "x",
        })
      )).toMatchObject({
        success: false,
      });
    })
  );
  it.effect(
    "requires event bounds for named probability event operations",
    () =>
      Effect.gen(function* () {
        const schema = asSchema(mathProbabilityInput);
        const validate = yield* requireValidator(schema.validate);
        (yield* expectValidation(
          validate({
            distribution: "normal",
            operation: "cumulative_probability",
            parameters: {},
            upper: "85",
          })
        )).toMatchObject({
          success: false,
        });
        (yield* expectValidation(
          validate({
            distribution: "normal",
            operation: "cumulative_probability",
            parameters: { mean: "70", standard_deviation: "10" },
          })
        )).toMatchObject({
          success: false,
        });
        (yield* expectValidation(
          validate({
            distribution: "normal",
            operation: "cumulative_probability",
            parameters: { mean: "70", standard_deviation: "10" },
            upper: "85",
          })
        )).toEqual({
          success: true,
          value: {
            distribution: "normal",
            operation: "cumulative_probability",
            parameters: { mean: "70", standard_deviation: "10" },
            upper: "85",
          },
        });
        (yield* expectValidation(
          validate({
            distribution: "binomial",
            operation: "point_probability",
            parameters: { n: "10", p: "1/5" },
            point: "3",
          })
        )).toEqual({
          success: true,
          value: {
            distribution: "binomial",
            operation: "point_probability",
            parameters: { n: "10", p: "1/5" },
            point: "3",
          },
        });
        (yield* expectValidation(
          validate({
            distribution: "normal",
            lower: "60",
            operation: "interval_probability",
            parameters: { mean: "70", standard_deviation: "10" },
            upper: "85",
          })
        )).toEqual({
          success: true,
          value: {
            distribution: "normal",
            lower: "60",
            operation: "interval_probability",
            parameters: { mean: "70", standard_deviation: "10" },
            upper: "85",
          },
        });
        (yield* expectValidation(
          validate({
            distribution: "poisson",
            inclusive: false,
            lower: "2",
            operation: "tail_probability",
            parameters: { lambda: "3" },
          })
        )).toEqual({
          success: true,
          value: {
            distribution: "poisson",
            inclusive: false,
            lower: "2",
            operation: "tail_probability",
            parameters: { lambda: "3" },
          },
        });
      })
  );
  it.effect("rejects malformed geometry points before tool execution", () =>
    Effect.gen(function* () {
      const schema = asSchema(mathGeometryInput);
      const validate = yield* requireValidator(schema.validate);
      (yield* expectValidation(
        validate({
          operation: "midpoint",
          points: [
            { x: "1", y: "2" },
            { x: "4,y:", y: "6" },
          ],
        })
      )).toMatchObject({
        success: false,
      });
      (yield* expectValidation(
        validate({
          operation: "midpoint",
          points: [
            { x: "1", y: "2" },
            { x: "4", y: "6" },
          ],
        })
      )).toEqual({
        success: true,
        value: {
          operation: "midpoint",
          points: [
            { x: "1", y: "2" },
            { x: "4", y: "6" },
          ],
        },
      });
    })
  );
  it("keeps geometry model metadata clear for two-point and four-point operations", () => {
    const schema = asSchema(mathGeometryInput);
    const jsonSchema = readSynchronous(schema.jsonSchema, "Math JSON Schema");
    if (!("properties" in jsonSchema && jsonSchema.properties)) {
      expect.fail("Math geometry schema must expose object properties.");
    }
    const { properties } = jsonSchema;
    expect(jsonSchema).toMatchObject({
      properties: {
        operation: {
          enum: expect.arrayContaining([
            "distance",
            "midpoint",
            "slope",
            "line",
            "intersection",
          ]),
        },
        points: {
          description: expect.stringContaining("Exactly two coordinate points"),
          maxItems: 4,
          minItems: 2,
        },
      },
    });
    expect(properties.points).not.toHaveProperty("title");
    expect(jsonSchema).toMatchObject({
      properties: {
        points: {
          description: expect.stringContaining("Exactly four points"),
        },
      },
    });
  });
  it("exposes grouped tool schemas as provider-compatible objects", () => {
    const jsonSchemas = [
      readSynchronous(
        asSchema(mathAlgebraInput).jsonSchema,
        "Math JSON Schema"
      ),
      readSynchronous(
        asSchema(mathEquationInput).jsonSchema,
        "Math JSON Schema"
      ),
      readSynchronous(
        asSchema(mathGeometryInput).jsonSchema,
        "Math JSON Schema"
      ),
      readSynchronous(
        asSchema(mathDiscreteInput).jsonSchema,
        "Math JSON Schema"
      ),
      readSynchronous(asSchema(mathMatrixInput).jsonSchema, "Math JSON Schema"),
      readSynchronous(asSchema(mathSeriesInput).jsonSchema, "Math JSON Schema"),
      readSynchronous(
        asSchema(mathStatisticsInput).jsonSchema,
        "Math JSON Schema"
      ),
      readSynchronous(
        asSchema(mathProbabilityInput).jsonSchema,
        "Math JSON Schema"
      ),
    ];
    for (const jsonSchema of jsonSchemas) {
      expect(jsonSchema).not.toHaveProperty("anyOf");
      expect(jsonSchema).toMatchObject({ type: "object" });
    }
  });
  it("keeps probability event fields visible behind one model-facing tool", () => {
    const schema = asSchema(mathProbabilityInput);
    const jsonSchema = readSynchronous(schema.jsonSchema, "Math JSON Schema");
    expect(jsonSchema).toMatchObject({
      properties: {
        distribution: {
          enum: ["bernoulli", "binomial", "normal", "poisson", "uniform"],
        },
        operation: {
          enum: expect.arrayContaining([
            "distribution",
            "expected_value",
            "variance_probability",
            "point_probability",
            "cumulative_probability",
            "tail_probability",
            "interval_probability",
          ]),
        },
        parameters: {
          description: expect.stringContaining(
            "normal uses mean and standard_deviation"
          ),
          properties: {
            mean: expect.objectContaining({ type: "string" }),
            standard_deviation: expect.objectContaining({ type: "string" }),
          },
          type: "object",
        },
        expression: expect.objectContaining({ type: "string" }),
        point: expect.objectContaining({ type: "string" }),
        lower: expect.objectContaining({ type: "string" }),
        upper: expect.objectContaining({ type: "string" }),
      },
      required: [],
      type: "object",
    });
    expect(jsonSchema).toMatchObject({
      properties: {
        parameters: {
          properties: expect.not.objectContaining({
            standardDeviation: expect.anything(),
          }),
        },
      },
    });
  });
  it("keeps model-facing field metadata for grouped algebra tools", () => {
    const schema = asSchema(mathAlgebraInput);
    const jsonSchema = readSynchronous(schema.jsonSchema, "Math JSON Schema");
    expect(jsonSchema).toMatchObject({
      properties: {
        expression: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
        left: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
        operation: {
          enum: expect.arrayContaining(["simplify", "domain", "compare"]),
          type: "string",
        },
        right: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
      },
      required: [],
      type: "object",
    });
  });
});
