import { describe, expect, it } from "@effect/vitest";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { asSchema } from "ai";
import { Effect, Predicate, Schema } from "effect";

/** Proves that AI SDK JSON Schema projection remains synchronous. */
function readSynchronous<A>(value: A | PromiseLike<A>): A {
  if (Predicate.isPromiseLike(value)) {
    expect.fail("AI SDK JSON Schema projection must remain synchronous.");
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

describe("createEffectSchema", () => {
  it.effect("keeps Effect descriptions in AI SDK JSON Schema", () =>
    Effect.gen(function* () {
      const inputSchema = createEffectSchema(
        Schema.Struct({
          query: Schema.String.annotate({
            description: "Search query for the model to generate.",
          }),
        }).annotate({ description: "Search tool input." })
      );
      const schema = asSchema(inputSchema);
      const jsonSchema = readSynchronous(schema.jsonSchema);
      const validate = yield* requireValidator(schema.validate);
      expect(jsonSchema).toMatchObject({
        description: "Search tool input.",
        properties: {
          query: {
            description: "Search query for the model to generate.",
            type: "string",
          },
        },
        required: ["query"],
        type: "object",
      });
      (yield* expectValidation(validate({ query: "fungsi rasional" }))).toEqual(
        {
          success: true,
          value: { query: "fungsi rasional" },
        }
      );
      (yield* expectValidation(validate({ query: 123 }))).toEqual(
        expect.objectContaining({ success: false })
      );
    })
  );
  it.effect(
    "uses custom model metadata without weakening Effect validation",
    () =>
      Effect.gen(function* () {
        const inputSchema = createEffectSchema(
          Schema.Struct({
            expression: Schema.String,
          }),
          {
            anyOf: [
              {
                properties: {
                  expression: { type: "string" },
                },
                required: ["expression"],
                type: "object",
              },
            ],
            type: "object",
          }
        );
        const schema = asSchema(inputSchema);
        const jsonSchema = readSynchronous(schema.jsonSchema);
        const validate = yield* requireValidator(schema.validate);
        expect(jsonSchema).toMatchObject({
          anyOf: [
            {
              properties: {
                expression: { type: "string" },
              },
              required: ["expression"],
              type: "object",
            },
          ],
          type: "object",
        });
        (yield* expectValidation(validate({}))).toMatchObject({
          success: false,
        });
      })
  );
});
