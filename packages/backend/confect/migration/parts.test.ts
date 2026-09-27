import { fromUIMessages, toUIMessages } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { projectTranscript } from "@repo/backend/confect/migration/parts";
import { Effect } from "effect";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, fromUIMessages: vi.fn(actual.fromUIMessages) };
});
afterEach(() => vi.restoreAllMocks());

const message: Docs["messages"] = {
  _id: Id("messages").make("test-message"),
  _creationTime: 1_700_000_000_000,
  chatId: Id("chats").make("test-chat"),
  identifier: "test-response",
  role: "assistant",
};

function part(
  fields: Omit<
    Docs["messageParts"],
    "_id" | "_creationTime" | "messageId" | "order"
  >
): Docs["messageParts"] {
  return {
    _id: Id("messageParts").make("test-part"),
    _creationTime: message._creationTime,
    messageId: message._id,
    order: 0,
    ...fields,
  };
}

describe("lossless Agent transcript projection", () => {
  it.effect("rejects an SDK row that has lost its message", () =>
    Effect.gen(function* () {
      const actual = vi.mocked(fromUIMessages).getMockImplementation();
      if (!actual) {
        throw new Error("Expected the real SDK projection");
      }
      vi.mocked(fromUIMessages).mockImplementationOnce(async (...args) =>
        (await actual(...args)).map((row) => ({ ...row, message: undefined }))
      );
      const failure = yield* projectTranscript(
        message,
        [part({ type: "text", textText: "Original" })],
        "test-thread",
        "test-user"
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "NinaMigrationError",
        cause: "Agent returned a row without its message.",
      });
    })
  );
  it.effect.each([
    part({
      type: "data-web-search",
      dataWebSearchQueries: ["gravity"],
      dataWebSearchSources: [],
      dataWebSearchStatus: "done",
    }),
    part({
      type: "data-scrape-url",
      dataScrapeUrlId: "recorded-card",
      dataScrapeUrlUrl: "https://example.invalid",
      dataScrapeUrlContent: "Recorded evidence",
      dataScrapeUrlStatus: "done",
    }),
    part({
      type: "data-math",
      dataMathData: {
        kind: "evaluate",
        status: "loading",
        input: { kind: "math", operation: "evaluate", expression: "1 + 1" },
      },
    }),
    part({
      type: "data-nakafa",
      dataNakafaData: {
        kind: "taxonomy",
        status: "loading",
        input: { locale: "en" },
      },
    }),
  ])(
    "preserves recorded %s evidence in an ordinary Agent tool result",
    (source) =>
      Effect.gen(function* () {
        const projected = yield* projectTranscript(
          message,
          [source],
          "test-thread",
          "test-user"
        );
        const [visible] = toUIMessages(projected.rows);
        const output = visible?.parts.find((item) => "output" in item);
        expect(output).toMatchObject({
          state: "output-available",
          output: {
            artifacts: [expect.objectContaining({ type: source.type })],
          },
        });
        expect(JSON.stringify(projected.rows)).not.toContain("undefined");
      })
  );

  it.effect.each([
    part({
      type: "tool-nakafa",
      toolToolCallId: "nakafa",
      toolState: "output-available",
      toolNakafaInput: { request: "read", objective: "Read", deliverables: [] },
      toolNakafaOutput: "Recorded lesson",
    }),
    part({
      type: "tool-deepResearch",
      toolToolCallId: "research",
      toolState: "output-available",
      toolDeepResearchInput: {
        request: "research",
        objective: "Research",
        sourceRequirements: [],
      },
      toolDeepResearchOutput: "Recorded research",
    }),
    part({
      type: "tool-math",
      toolToolCallId: "math",
      toolState: "output-available",
      toolMathInput: {
        request: "calculate",
        objective: "Calculate",
        given: [],
      },
      toolMathOutput: "2",
    }),
  ])("retains a completed specialist result: %s", (source) =>
    Effect.gen(function* () {
      const projected = yield* projectTranscript(
        message,
        [source],
        "test-thread",
        "test-user"
      );
      const [visible] = toUIMessages(projected.rows);
      expect(visible?.parts).toContainEqual(
        expect.objectContaining({
          type: source.type,
          output: {
            text:
              source.toolNakafaOutput ??
              source.toolDeepResearchOutput ??
              source.toolMathOutput,
            artifacts: [],
          },
        })
      );
    })
  );

  it.effect(
    "keeps failed tool calls and moves suggestions to response metadata",
    () =>
      Effect.gen(function* () {
        const projected = yield* projectTranscript(
          message,
          [
            part({ type: "text", textText: "The recorded response." }),
            part({ type: "step-start" }),
            part({
              type: "tool-math",
              toolToolCallId: "failed-math",
              toolState: "output-error",
              toolMathInput: {
                request: "calculate",
                objective: "Calculate",
                given: [],
              },
              toolErrorText: "Recorded failure",
            }),
            part({
              type: "data-suggestions",
              dataSuggestionsData: ["Show an example."],
            }),
          ],
          "test-thread",
          "test-user"
        );
        expect(projected.suggestions).toEqual(["Show an example."]);
        const [visible] = toUIMessages(projected.rows);
        expect(visible?.parts).toContainEqual(
          expect.objectContaining({
            type: "tool-math",
            state: "output-error",
            errorText: "Recorded failure",
          })
        );
        expect(visible?.text).toBe("The recorded response.");
      })
  );

  it.effect.each([
    part({ type: "text" }),
    part({
      type: "data-math",
      dataMathData: {
        kind: "evaluate",
        status: "loading",
        input: { kind: "math", operation: "evaluate", order: -1 },
      },
    }),
  ])(
    "fails explicitly when a stored part cannot be converted without loss: %s",
    (source) =>
      Effect.gen(function* () {
        const failure = yield* projectTranscript(
          message,
          [source],
          "test-thread",
          "test-user"
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("NinaMigrationError");
        expect(failure.cause).toBeDefined();
      })
  );

  it.effect(
    "preserves the typed migration failure when the SDK rejects a transcript",
    () =>
      Effect.gen(function* () {
        vi.mocked(fromUIMessages).mockRejectedValueOnce(
          new Error("Invalid SDK transcript")
        );
        const failure = yield* projectTranscript(
          message,
          [part({ type: "text", textText: "Original" })],
          "test-thread",
          "test-user"
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("NinaMigrationError");
        expect(failure.cause).toMatchObject({
          message: "Invalid SDK transcript",
        });
      })
  );
});
