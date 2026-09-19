import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { createNakafaTestService } from "@repo/ai/agents/nakafa/tools/test";
import { ModelIdSchema } from "@repo/ai/config/model";
import type { NinaTurn } from "@repo/ai/nina/contract/turn";
import { runNinaAgentTurn } from "@repo/ai/nina/runtime/agent";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore, NinaStoreError } from "@repo/ai/nina/runtime/store";
import { createNinaStreamResponse } from "@repo/ai/nina/runtime/stream";
import {
  NinaSuggestionError,
  writeNinaSuggestions,
} from "@repo/ai/nina/runtime/suggest";
import type { MyUIMessage } from "@repo/ai/types/message";
import { convertToModelMessages, NoSuchToolError } from "ai";
import { Deferred, Effect } from "effect";

const compression = vi.hoisted(() => ({ trim: false }));
vi.mock("@repo/ai/lib/message", () => ({
  compressMessages: (messages: MyUIMessage[]) => ({
    messages: compression.trim ? messages.slice(-1) : messages,
    tokens: "10",
  }),
}));
vi.mock("ai", { spy: true });

vi.mock("@repo/ai/nina/runtime/agent", () => ({ runNinaAgentTurn: vi.fn() }));
vi.mock("@repo/ai/nina/runtime/suggest", { spy: true });
vi.mock("@repo/ai/config/app", () => ({
  provider: { languageModel: () => "test" },
}));
vi.mock("@repo/ai/nina/capability/catalog", () => ({
  createNinaCapabilityCatalog: () => Effect.succeed({}),
}));
vi.mock("@repo/ai/nina/runtime/repair", () => ({
  repairNinaToolCall: () => Effect.succeed(null),
}));
const modelId = ModelIdSchema.make("nakafa-lite");
const turn = {
  copy: {
    errorMessage: "Something went wrong.",
    rateLimitMessage: "Please try again later.",
  },
  page: {
    locale: "en",
    needsFetch: false,
    nina: {
      learning: {
        assetId: "asset:id:material:math:vector:addition",
        locale: "en",
        slug: "subjects/mathematics/vector/addition",
        title: "Vector Addition",
        url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
        verified: true,
      },
      snapshot: {
        capturedAt: "2026-06-22T00:00:00.000Z",
        learning: {
          assetId: "asset:id:material:math:vector:addition",
          locale: "en",
          slug: "subjects/mathematics/vector/addition",
          title: "Vector Addition",
          url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
          verified: true,
        },
        source: "current-page",
        tools: {
          allowDeepResearch: true,
          allowMath: true,
          allowNakafa: true,
          allowPageFetch: true,
          evidenceScope: "verified-page",
        },
      },
      tools: {
        allowDeepResearch: true,
        allowMath: true,
        allowNakafa: true,
        allowPageFetch: true,
        evidenceScope: "verified-page",
      },
      transition: {
        reason: "page-context",
        toContextKey: "canonical:vector:addition",
      },
    },
    slug: "/subjects/mathematics/vector/addition",
    url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
    verified: true,
  },
  runtime: {
    currentDate: "June 22, 2026",
    modelId,
  },
  user: {
    location: {
      city: "Jakarta",
      country: "Indonesia",
      countryRegion: "Jakarta",
      latitude: "-6.2",
      longitude: "106.8",
    },
    role: "student",
  },
} satisfies NinaTurn;

describe("nina/runtime/stream cancellation", () => {
  beforeEach(() => {
    compression.trim = false;
    vi.mocked(runNinaAgentTurn).mockReset();
    vi.mocked(writeNinaSuggestions).mockClear();
    vi.mocked(writeNinaSuggestions).mockReturnValue(Effect.void);
  });

  it.effect.each(["reader", "request"])(
    "aborts the provider on %s cancellation and waits for local settlement before refund",
    (source) =>
      Effect.gen(function* () {
        const controller = yield* Effect.sync(() => new AbortController());
        const completion = yield* Deferred.make<void>();
        const providerStarted = yield* Deferred.make<AbortSignal>();
        const scheduled = yield* Deferred.make<void>();
        let refunded = false;
        vi.mocked(runNinaAgentTurn).mockImplementation((input) =>
          Effect.gen(function* () {
            yield* Deferred.succeed(providerStarted, input.signal);
            input.stream.writer.write({ type: "text-start", id: "answer" });
            input.stream.writer.write({
              type: "text-delta",
              id: "answer",
              delta: "Partial",
            });
            yield* Deferred.await(completion);
            return [];
          })
        );
        const response = yield* createNinaStreamResponse(
          turn,
          controller.signal,
          controller.signal
        ).pipe(
          Effect.provideService(NinaStore, {
            loadMessages: Effect.succeed([]),
            saveAssistant: () =>
              Effect.die("Canceled responses must not succeed"),
            saveFailure: ({ settled }) =>
              settled.pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    refunded = true;
                  })
                ),
                Effect.andThen(Deferred.succeed(scheduled, undefined))
              ),
            saveTitle: () => Effect.void,
            saveTrace: () => Effect.void,
          }),
          Effect.provideService(NinaReporter, { report: () => Effect.void }),
          Effect.provideService(Nakafa, createNakafaTestService()),
          Effect.provideService(NakafaSearch, {
            search: () => Effect.die("Unexpected search"),
          })
        );
        const reader = response.body?.getReader();
        expect(reader).toBeDefined();
        if (!reader) {
          return;
        }
        yield* Effect.promise(() => reader.read());
        const providerSignal = yield* Deferred.await(providerStarted);
        if (source === "request") {
          controller.abort();
        }
        yield* Effect.promise(() => reader.cancel());
        yield* Effect.callback<void>((resume) => {
          if (providerSignal.aborted) {
            resume(Effect.void);
          } else {
            providerSignal.addEventListener(
              "abort",
              () => resume(Effect.void),
              { once: true }
            );
          }
        });
        expect(providerSignal.aborted).toBe(true);
        expect(refunded).toBe(false);
        yield* Deferred.succeed(completion, undefined);
        yield* Deferred.await(scheduled);
        expect(refunded).toBe(true);
        expect(writeNinaSuggestions).not.toHaveBeenCalled();
      })
  );
});

const transcript: MyUIMessage[] = [
  {
    id: "user",
    role: "user",
    parts: [{ type: "text", text: "Explain vectors" }],
  },
];

function streamServices(messages = transcript) {
  const failure = new NinaStoreError({
    message: "Persistence unavailable",
    source: "test",
  });
  const saveAssistant = vi.fn(
    (): Effect.Effect<void, NinaStoreError> => Effect.void
  );
  const saveTitle = vi.fn(
    (): Effect.Effect<void, NinaStoreError> => Effect.void
  );
  const saveFailure = vi.fn(
    ({
      settled,
    }: {
      settled: Effect.Effect<void>;
    }): Effect.Effect<void, NinaStoreError> => settled
  );
  const report = vi.fn(() => Effect.void);
  return {
    failure,
    saveAssistant,
    saveTitle,
    saveFailure,
    report,
    provide: <A, E>(
      program: Effect.Effect<
        A,
        E,
        NinaStore | NinaReporter | Nakafa | NakafaSearch
      >
    ) =>
      program.pipe(
        Effect.provideService(NinaStore, {
          loadMessages: Effect.succeed(messages),
          saveAssistant,
          saveTitle,
          saveFailure,
          saveTrace: () => Effect.void,
        }),
        Effect.provideService(NinaReporter, { report }),
        Effect.provideService(Nakafa, createNakafaTestService()),
        Effect.provideService(NakafaSearch, {
          search: () => Effect.die("Unexpected search"),
        })
      ),
  };
}

it.effect.each(["first", "continuing", "persistence-failure"])(
  "persists a completed %s answer through the real SDK stream",
  (mode) =>
    Effect.gen(function* () {
      compression.trim = mode === "continuing";
      const services = streamServices(
        mode === "continuing" ? [...transcript, ...transcript] : transcript
      );
      if (mode === "persistence-failure") {
        services.saveAssistant.mockReturnValue(Effect.fail(services.failure));
        services.saveTitle.mockReturnValue(Effect.fail(services.failure));
        vi.mocked(writeNinaSuggestions).mockReturnValue(
          Effect.fail(
            new NinaSuggestionError({
              message: "suggestion provider unavailable",
            })
          )
        );
      } else {
        vi.mocked(writeNinaSuggestions).mockReturnValue(Effect.void);
      }
      vi.mocked(runNinaAgentTurn).mockImplementation((input) =>
        Effect.promise(async () => {
          await input.settings.repairToolCall?.({
            toolCall: {
              type: "tool-call",
              toolCallId: "repair",
              toolName: "unknown",
              input: "{}",
            },
            tools: input.settings.tools,
            error: new NoSuchToolError({ toolName: "unknown" }),
            inputSchema: async () => ({}),
            messages: [],
            instructions: undefined,
            system: undefined,
          });
          const metadata = input.stream.readFinishMetadata({
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            inputTokenDetails: {
              noCacheTokens: 1,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: { textTokens: 1, reasoningTokens: undefined },
          });
          input.stream.writer.write({ type: "text-start", id: "answer" });
          input.stream.writer.write({
            type: "text-delta",
            id: "answer",
            delta: "A vector has magnitude and direction.",
          });
          input.stream.writer.write({ type: "text-end", id: "answer" });
          input.stream.writer.write({
            type: "finish",
            finishReason: "stop",
            messageMetadata: metadata,
          });
          return [];
        })
      );
      const signal = yield* Effect.abortSignal;
      const response = yield* services.provide(
        createNinaStreamResponse(turn, signal, signal)
      );
      expect(yield* Effect.promise(() => response.text())).toContain(
        "magnitude and direction"
      );
      expect(services.saveAssistant).toHaveBeenCalledOnce();
      expect(services.saveFailure).not.toHaveBeenCalled();
      expect(services.saveTitle).toHaveBeenCalledTimes(
        mode === "continuing" ? 0 : 1
      );
      if (mode === "persistence-failure") {
        expect(services.report).toHaveBeenCalledWith(
          expect.objectContaining({ source: "saveTitle" })
        );
        expect(services.report).toHaveBeenCalledWith(
          expect.objectContaining({ source: "saveAssistantResponse" })
        );
        expect(services.report).toHaveBeenCalledWith(
          expect.objectContaining({ source: "writeNinaSuggestions" })
        );
      }
    })
);

it.effect(
  "aborts and schedules failure once when provider callbacks and execution both fail",
  () =>
    Effect.gen(function* () {
      const services = streamServices([]);
      services.saveFailure.mockReturnValue(Effect.fail(services.failure));
      vi.mocked(runNinaAgentTurn).mockImplementation((input) =>
        Effect.gen(function* () {
          expect(
            input.stream.formatError(new Error("Rate limit exceeded"))
          ).toBe(turn.copy.rateLimitMessage);
          expect(input.stream.formatError("unknown")).toBe(
            turn.copy.errorMessage
          );
          expect(
            input.stream.formatError(new Error("Provider unavailable"))
          ).toBe("Provider unavailable");
          input.stream.onError(new Error("Provider unavailable"), "provider");
          input.stream.onError(new Error("Duplicate failure"), "provider");
          expect(input.signal.aborted).toBe(true);
          return yield* Effect.die("Provider failed");
        })
      );
      const signal = yield* Effect.abortSignal;
      const response = yield* services.provide(
        createNinaStreamResponse(turn, signal, signal)
      );
      expect(yield* Effect.promise(() => response.text())).toContain("error");
      expect(services.saveFailure).toHaveBeenCalledOnce();
      expect(services.report).toHaveBeenCalledWith(
        expect.objectContaining({ source: "saveAssistantFailure" })
      );
      expect(services.saveAssistant).not.toHaveBeenCalled();
    })
);

it.effect(
  "rejects malformed input before starting a provider or deferred settlement",
  () =>
    Effect.gen(function* () {
      const services = streamServices();
      vi.mocked(convertToModelMessages).mockRejectedValueOnce(
        new Error("Invalid UI message")
      );
      const signal = yield* Effect.abortSignal;
      const failure = yield* services
        .provide(createNinaStreamResponse(turn, signal, signal))
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ source: "convertToModelMessages" });
      expect(services.saveFailure).not.toHaveBeenCalled();
    })
);

it.effect.each(["main", "before-hints", "hints", "request-cancel"])(
  "settles the main answer correctly when the shared budget ends during %s",
  (phase) =>
    Effect.gen(function* () {
      const request = yield* Effect.sync(() => new AbortController());
      const deadline = yield* Effect.sync(() => new AbortController());
      const services = streamServices();
      const suggestions = vi.mocked(writeNinaSuggestions);
      suggestions.mockClear();
      suggestions.mockImplementation(({ signal }) =>
        Effect.gen(function* () {
          expect(signal.aborted).toBe(false);
          if (phase === "request-cancel") {
            request.abort();
          } else {
            deadline.abort();
          }
          expect(signal.aborted).toBe(true);
          return yield* new NinaSuggestionError({
            message: "Hint work stopped at deadline",
          });
        })
      );
      vi.mocked(runNinaAgentTurn).mockImplementation(({ signal, stream }) =>
        Effect.sync(() => {
          expect(signal.aborted).toBe(false);
          stream.writer.write({ type: "text-start", id: "answer" });
          stream.writer.write({
            type: "text-delta",
            id: "answer",
            delta: "A verified answer.",
          });
          if (phase === "main") {
            deadline.abort();
            // AI SDK emits this marker when the main provider is aborted.
            stream.writer.write({ type: "abort" });
          } else {
            stream.writer.write({ type: "text-end", id: "answer" });
            stream.writer.write({ type: "finish", finishReason: "stop" });
            if (phase === "before-hints") {
              deadline.abort();
            }
          }
          return [];
        })
      );
      const response = yield* services.provide(
        createNinaStreamResponse(turn, request.signal, deadline.signal)
      );
      const text = yield* Effect.promise(() => response.text());
      expect(text).toContain("A verified answer.");
      const failed = phase === "main" || phase === "request-cancel";
      expect(services.saveAssistant).toHaveBeenCalledTimes(failed ? 0 : 1);
      expect(services.saveFailure).toHaveBeenCalledTimes(failed ? 1 : 0);
      expect(services.saveTitle).not.toHaveBeenCalled();
      expect(suggestions).toHaveBeenCalledTimes(
        phase === "main" || phase === "before-hints" ? 0 : 1
      );
    })
);
