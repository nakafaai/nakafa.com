import { describe, expect, it } from "@effect/vitest";
import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import { Effect, Schema } from "effect";

const contract = Schema.Struct({ title: Schema.String });

describe("public agent contracts", () => {
  it.effect("rejects excess input without admitting untrusted fields", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeAgentInput(
          contract,
          { title: "Lesson", admin: true },
          "Invalid input."
        )
      );
      expect(error).toMatchObject({
        _tag: "NakafaAgentInputError",
        message: "Invalid input.",
      });
      expect(error.cause).toContain("admin");
    })
  );

  it.effect("reports invalid generated output as a data failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeAgentOutput(contract, { title: 12 }, "Invalid published output.")
      );
      expect(error).toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Invalid published output.",
      });
      expect(error.cause).toContain("title");
      expect(
        yield* decodeAgentOutput(
          contract,
          { title: "Lesson" },
          "Invalid output."
        )
      ).toEqual({ title: "Lesson" });
    })
  );
});
