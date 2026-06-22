import { ModelIdSchema } from "@repo/ai/config/model";
import {
  createNinaAgentContext,
  type NinaAgentAdapter,
  type NinaAgentChat,
  type NinaAgentPage,
  type NinaAgentRuntime,
  type NinaAgentUser,
  runNinaAgentTurn,
} from "@repo/ai/nina/agent";
import type { NinaContextPack } from "@repo/ai/nina/context";
import type { MyMetadata, MyUIMessage } from "@repo/ai/types/message";
import type {
  LanguageModelUsage,
  ModelMessage,
  ToolSet,
  UIMessageStreamWriter,
} from "ai";
import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedAgentSettings {
  readonly id?: string;
  readonly instructions?: string;
  readonly prepareStep?: (input: {
    readonly messages: ModelMessage[];
    readonly stepNumber: number;
  }) => unknown;
  readonly stopWhen?: unknown;
  readonly tools?: ToolSet;
}

interface CapturedStreamOptions {
  readonly messages: ModelMessage[];
  readonly timeout?: unknown;
}

interface CapturedMessageStreamOptions {
  readonly messageMetadata?: (input: {
    readonly part:
      | { readonly type: "start" }
      | { readonly type: "text-delta" }
      | { readonly type: "finish" }
      | { readonly totalUsage: LanguageModelUsage; readonly type: "finish" };
  }) => MyMetadata | undefined;
  readonly onError?: (error: unknown) => string;
}

interface FakeAgentState {
  deltaMetadata?: MyMetadata;
  emptyFinishMetadata?: MyMetadata;
  finishMetadata?: MyMetadata;
  responseFailure?: Error;
  settings?: CapturedAgentSettings;
  startMetadata?: MyMetadata;
  streamErrorMessage?: string;
  streamFailure?: Error;
  streamOptions?: CapturedStreamOptions;
}

const fakeAgentState = vi.hoisted((): FakeAgentState => ({}));

/** Returns a complete AI SDK usage object for metadata callbacks. */
function createUsage(): LanguageModelUsage {
  return {
    cachedInputTokens: undefined,
    inputTokenDetails: {
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
      noCacheTokens: 4,
    },
    inputTokens: 4,
    outputTokenDetails: {
      reasoningTokens: undefined,
      textTokens: 6,
    },
    outputTokens: 6,
    raw: undefined,
    reasoningTokens: undefined,
    totalTokens: 10,
  };
}

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  /** Captures ToolLoopAgent settings and returns a deterministic stream result. */
  class FakeToolLoopAgent {
    constructor(settings: CapturedAgentSettings) {
      fakeAgentState.settings = settings;
    }

    /** Streams a single assistant response without contacting a provider. */
    stream(options: CapturedStreamOptions) {
      if (fakeAgentState.streamFailure) {
        return Promise.reject(fakeAgentState.streamFailure);
      }

      fakeAgentState.streamOptions = options;
      fakeAgentState.settings?.prepareStep?.({
        messages: options.messages,
        stepNumber: 0,
      });

      return Promise.resolve({
        response: fakeAgentState.responseFailure
          ? Promise.reject(fakeAgentState.responseFailure)
          : Promise.resolve({
              messages: [
                {
                  content: [{ text: "Ready.", type: "text" }],
                  role: "assistant",
                },
              ],
            }),
        /** Captures stream metadata callbacks without opening an SSE stream. */
        toUIMessageStream(streamOptions: CapturedMessageStreamOptions) {
          fakeAgentState.startMetadata = streamOptions.messageMetadata?.({
            part: { type: "start" },
          });
          fakeAgentState.deltaMetadata = streamOptions.messageMetadata?.({
            part: { type: "text-delta" },
          });
          fakeAgentState.emptyFinishMetadata = streamOptions.messageMetadata?.({
            part: { type: "finish" },
          });
          fakeAgentState.finishMetadata = streamOptions.messageMetadata?.({
            part: { totalUsage: createUsage(), type: "finish" },
          });
          fakeAgentState.streamErrorMessage = streamOptions.onError?.(
            new Error("stream failed")
          );

          return new ReadableStream();
        },
      });
    }
  }

  return {
    ...actual,
    ToolLoopAgent: FakeToolLoopAgent,
  };
});

vi.mock("@repo/ai/config/app", () => ({
  provider: {
    /** Supplies a fake model object because the mocked ToolLoopAgent never calls it. */
    languageModel: () => ({
      modelId: "test-model",
      provider: "test-provider",
      specificationVersion: "v2",
    }),
  },
}));

const modelId = ModelIdSchema.make("nakafa-lite");

const ninaContext = {
  learning: {
    assetId: "asset:id:material:mathematics:vector:addition",
    locale: "en",
    slug: "subjects/mathematics/vector/addition",
    title: "Vector Addition",
    url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
    verified: true,
  },
  placement: {
    mode: "placement",
    nodeKey: "curriculum:vector:addition",
    parentHref: "/en/curriculum/mathematics/vector",
    parentTitle: "Vector",
    programKey: "cambridge-lower-secondary",
  },
  snapshot: {
    capturedAt: "2026-06-21T00:00:00.000Z",
    learning: {
      assetId: "asset:id:material:mathematics:vector:addition",
      locale: "en",
      slug: "subjects/mathematics/vector/addition",
      title: "Vector Addition",
      url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
      verified: true,
    },
    placement: {
      mode: "placement",
      nodeKey: "curriculum:vector:addition",
      parentHref: "/en/curriculum/mathematics/vector",
      parentTitle: "Vector",
      programKey: "cambridge-lower-secondary",
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
    toContextKey:
      "placement:cambridge-lower-secondary:curriculum:vector:addition:subjects/mathematics/vector/addition",
  },
} satisfies NinaContextPack;

const page = {
  locale: "en",
  needsFetch: true,
  nina: ninaContext,
  slug: "/subjects/mathematics/vector/addition",
  url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
  verified: true,
} satisfies NinaAgentPage;

const runtime = {
  currentDate: "June 21, 2026",
  modelId,
} satisfies NinaAgentRuntime;

const user = {
  learningProfile: undefined,
  location: {
    city: "Jakarta",
    country: "Indonesia",
    countryRegion: "Jakarta",
    latitude: "-6.2",
    longitude: "106.8",
  },
  role: "student",
} satisfies NinaAgentUser;

const chat = {
  finalMessages: [
    {
      content: [{ text: "Explain this page.", type: "text" }],
      role: "user",
    },
  ],
} satisfies NinaAgentChat;

describe("nina/agent", () => {
  beforeEach(() => {
    fakeAgentState.deltaMetadata = undefined;
    fakeAgentState.emptyFinishMetadata = undefined;
    fakeAgentState.finishMetadata = undefined;
    fakeAgentState.responseFailure = undefined;
    fakeAgentState.settings = undefined;
    fakeAgentState.startMetadata = undefined;
    fakeAgentState.streamFailure = undefined;
    fakeAgentState.streamErrorMessage = undefined;
    fakeAgentState.streamOptions = undefined;
  });

  it("builds specialist context from validated Nina session inputs", () => {
    const context = createNinaAgentContext({ page, runtime, user });

    expect(context).toMatchObject({
      currentDate: "June 21, 2026",
      needsPageFetch: true,
      slug: "subjects/mathematics/vector/addition",
      url: page.url,
      userRole: "student",
      verified: true,
    });
    expect(context.nina?.snapshot).toEqual(ninaContext.snapshot);
  });

  it("runs the ToolLoopAgent lifecycle with Nina metadata and adapter-owned tools", async () => {
    const writer = {
      merge: vi.fn(),
      onError: undefined,
      write: vi.fn(),
    } satisfies UIMessageStreamWriter<MyUIMessage>;
    const tools = {};
    const adapter = {
      formatStreamError: () => "translated stream error",
      onStreamError: vi.fn(),
      prepareStep: ({ messages }) => ({ messages }),
      readFinishMetadata: () => ({
        credits: 2,
        model: modelId,
        tokens: { input: 4, output: 6, total: 10 },
      }),
      repairToolCall: () => Effect.runPromise(Effect.succeed(null)),
      tools,
      writer,
    } satisfies NinaAgentAdapter<typeof tools>;

    const turn = await Effect.runPromise(
      runNinaAgentTurn({ adapter, chat, page, runtime, user })
    );

    expect(fakeAgentState.settings?.id).toBe("nina");
    expect(fakeAgentState.settings?.instructions).toContain("Vector Addition");
    expect(fakeAgentState.settings?.tools).toBe(tools);
    expect(fakeAgentState.streamOptions?.messages).toEqual(chat.finalMessages);
    expect(writer.merge).toHaveBeenCalledOnce();
    expect(adapter.onStreamError).toHaveBeenCalledWith(
      expect.any(Error),
      "toUIMessageStream"
    );
    expect(fakeAgentState.streamErrorMessage).toBe("translated stream error");
    expect(fakeAgentState.startMetadata).toMatchObject({
      model: modelId,
      ninaContextSnapshot: ninaContext.snapshot,
    });
    expect(fakeAgentState.deltaMetadata).toBeUndefined();
    expect(fakeAgentState.emptyFinishMetadata).toBeUndefined();
    expect(fakeAgentState.finishMetadata).toMatchObject({
      model: modelId,
      ninaContextTransition: ninaContext.transition,
      tokens: { input: 4, output: 6, total: 10 },
    });
    expect(turn.messages).toEqual([
      {
        content: [{ text: "Ready.", type: "text" }],
        role: "assistant",
      },
    ]);
  });

  it("keeps ToolLoopAgent stream startup failures in the Effect error channel", async () => {
    fakeAgentState.streamFailure = new Error("stream startup failed");

    const exit = await Effect.runPromiseExit(
      runNinaAgentTurn({
        adapter: createAdapter(),
        chat,
        page,
        runtime,
        user,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("keeps ToolLoopAgent response failures in the Effect error channel", async () => {
    fakeAgentState.responseFailure = new Error("response failed");

    const exit = await Effect.runPromiseExit(
      runNinaAgentTurn({
        adapter: createAdapter(),
        chat,
        page,
        runtime,
        user,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

/** Creates the minimal app Adapter needed to exercise Nina's package Module. */
function createAdapter() {
  const writer = {
    merge: vi.fn(),
    onError: undefined,
    write: vi.fn(),
  } satisfies UIMessageStreamWriter<MyUIMessage>;
  const tools = {};

  return {
    formatStreamError: () => "translated stream error",
    onStreamError: vi.fn(),
    prepareStep: ({ messages }) => ({ messages }),
    readFinishMetadata: () => ({
      credits: 2,
      model: modelId,
      tokens: { input: 4, output: 6, total: 10 },
    }),
    repairToolCall: () => Effect.runPromise(Effect.succeed(null)),
    tools,
    writer,
  } satisfies NinaAgentAdapter<typeof tools>;
}
