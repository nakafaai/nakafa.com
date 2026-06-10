import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const ARTICLE_CONTENT_ID = NakafaAgentContentRefInputSchema.make(
  "en/articles/politics/dynastic-politics-asian-values"
);
const MISSING_CONTENT_ID = NakafaAgentContentRefInputSchema.make(
  "en/articles/missing"
);

describe("nakafa read tool", () => {
  it("writes loading and done parts for content reads", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      read({
        input: { content_ref: ARTICLE_CONTENT_ID },
        toolCallId: "read-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toContain("# Nakafa Content");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-nakafa",
        data: expect.objectContaining({
          kind: "content",
          status: "done",
          result: expect.objectContaining({
            content_id: ARTICLE_CONTENT_ID,
          }),
        }),
      })
    );
  });

  it("writes an error part when content is missing", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      read({
        input: { content_ref: MISSING_CONTENT_ID },
        toolCallId: "read-2",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toBe("Nakafa content was not found.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "content", status: "error" }),
      })
    );
  });

  it("writes an error part when content reading fails", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      read({
        input: { content_ref: ARTICLE_CONTENT_ID },
        toolCallId: "read-3",
        writer,
      }).pipe(
        Effect.provideService(
          Nakafa,
          Nakafa.make({
            exercise: () => Effect.die("unused"),
            quran: () => Effect.die("unused"),
            read: () =>
              Effect.fail(
                new NakafaAgentDataReadError({
                  message: "Read failed.",
                })
              ),
            taxonomy: () => Effect.die("unused"),
            verify: () => Effect.succeed(false),
          })
        )
      )
    );

    expect(output).toBe("Read failed.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "content",
          status: "error",
          error: "Read failed.",
        }),
      })
    );
  });
});
