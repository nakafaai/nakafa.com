import { describe, expect, it } from "@effect/vitest";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect } from "effect";

const ARTICLE_CONTENT_ID = NakafaAgentContentRefInputSchema.make(
  readNakafaContentRefFixture(
    "en",
    "articles/politics/dynastic-politics-asian-values",
    "articles"
  ).content_id
);
const ARTICLE_URL = NakafaAgentContentRefInputSchema.make(
  "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values"
);
const MISSING_CONTENT_ID = NakafaAgentContentRefInputSchema.make(
  readNakafaContentRefFixture("en", "articles/politics/missing", "articles")
    .content_id
);
const TRYOUT_URL = NakafaAgentContentRefInputSchema.make(
  "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-2"
);
describe("nakafa read tool", () => {
  it.effect("writes loading and done parts for content reads", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* read({
        input: { content_ref: ARTICLE_CONTENT_ID },
        toolCallId: "read-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));
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
    })
  );
  it.effect("accepts canonical URL projections for current-page reads", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* read({
        input: { content_ref: ARTICLE_URL },
        toolCallId: "read-url",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));
      expect(output).toContain("# Nakafa Content");
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "content",
            status: "done",
          }),
        })
      );
    })
  );
  it.effect("writes an error part when content is missing", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* read({
        input: { content_ref: MISSING_CONTENT_ID },
        toolCallId: "read-2",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));
      expect(output).toBe("Nakafa content was not found.");
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "content", status: "error" }),
        })
      );
    })
  );
  it.effect("does not invent a markdown read for tryout references", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* read({
        input: { content_ref: TRYOUT_URL },
        toolCallId: "read-tryout",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));
      expect(output).toBe("Nakafa content was not found.");
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "content", status: "error" }),
        })
      );
    })
  );
  it.effect("writes an error part when content reading fails", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* read({
        input: { content_ref: ARTICLE_CONTENT_ID },
        toolCallId: "read-3",
        writer,
      }).pipe(
        Effect.provideService(
          Nakafa,
          Nakafa.of({
            quran: () => Effect.die("unused"),
            quranV2: () => Effect.die("unused"),
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
    })
  );
});
