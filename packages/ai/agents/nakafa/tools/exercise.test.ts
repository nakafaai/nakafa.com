import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { exercise } from "@repo/ai/agents/nakafa/tools/exercise";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const EXERCISE_CONTENT_ID = NakafaAgentContentRefInputSchema.make(
  readNakafaContentRefFixture(
    "en",
    "exercises/high-school/snbt/general-knowledge/try-out/2026/set-2",
    "exercises"
  ).content_id
);

describe("nakafa exercise tool", () => {
  it("writes loading and done parts for exercise sets", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      exercise({
        input: { content_ref: EXERCISE_CONTENT_ID },
        toolCallId: "exercise-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toContain("# Nakafa Exercises");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "exercise",
          status: "done",
          result: expect.objectContaining({ count: expect.any(Number) }),
        }),
      })
    );
  });

  it("writes loading and done parts for one exercise", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      exercise({
        input: { content_ref: EXERCISE_CONTENT_ID, exercise_number: 1 },
        toolCallId: "exercise-single",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toContain("- Exercise number: 1");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "exercise",
          result: expect.objectContaining({
            count: 1,
            exercise_number: 1,
          }),
          status: "done",
        }),
      })
    );
  });

  it("writes an error part when the exercise is missing", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      exercise({
        input: { content_ref: EXERCISE_CONTENT_ID, exercise_number: 99_999 },
        toolCallId: "exercise-2",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toBe("Nakafa exercise content was not found.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "exercise", status: "error" }),
      })
    );
  });

  it("writes an error part when exercise reading fails", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      exercise({
        input: { content_ref: EXERCISE_CONTENT_ID },
        toolCallId: "exercise-3",
        writer,
      }).pipe(
        Effect.provideService(
          Nakafa,
          Nakafa.make({
            exercise: () =>
              Effect.fail(
                new NakafaAgentDataReadError({
                  message: "Exercise read failed.",
                })
              ),
            quran: () => Effect.die("unused"),
            read: () => Effect.die("unused"),
            taxonomy: () => Effect.die("unused"),
            verify: () => Effect.succeed(false),
          })
        )
      )
    );

    expect(output).toBe("Exercise read failed.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "exercise",
          status: "error",
          error: "Exercise read failed.",
        }),
      })
    );
  });
});
