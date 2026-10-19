import { describe, expect, it } from "@effect/vitest";
import { decodeModeArguments } from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, Schema } from "effect";

const Pair = Schema.Tuple([Schema.String, Schema.String]);
const PairWithOptional = Schema.Tuple([
  Schema.String,
  Schema.optionalKey(Schema.String),
]);

describe("acceptance mode arguments", () => {
  it.effect("decodes the arguments that the schema names, in their order", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeModeArguments("pair <a> <b>", Pair, ["one", "two"])
      ).toEqual(["one", "two"]);
    })
  );

  it.effect("ignores an argument past the schema", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeModeArguments("pair <a> <b>", Pair, [
          "one",
          "two",
          "three",
        ])
      ).toEqual(["one", "two"]);
    })
  );

  it.effect("leaves an optional trailing argument out when none is given", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeModeArguments("pair <a> [b]", PairWithOptional, ["one"])
      ).toEqual(["one"]);
    })
  );

  it.effect("refuses a missing argument with the usage of its mode", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeModeArguments("pair <a> <b>", Pair, ["one"]).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance pair <a> <b>",
      });
    })
  );
});
