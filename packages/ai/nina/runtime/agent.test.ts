import { ModelIdSchema } from "@repo/ai/config/model";
import {
  createNinaAgentContext,
  type NinaPage,
  type NinaRuntime,
  type NinaUser,
} from "@repo/ai/nina/contract/turn";
import type { NinaContextPack } from "@repo/ai/nina/memory/pack";
import { NinaAgentError, runNinaAgentTurn } from "@repo/ai/nina/runtime/agent";
import type { NinaPrepareStep, NinaToolSet } from "@repo/ai/nina/runtime/step";
import {
  nakafaToolInputSchema,
  researchToolInputSchema,
  textOutputSchema,
} from "@repo/ai/schema/tools";
import type { MyMetadata, MyUIMessage } from "@repo/ai/types/message";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import type {
  LanguageModelUsage,
  ModelMessage,
  TextStreamPart,
  UIMessageStreamWriter,
} from "ai";
import { tool } from "ai";
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedAgentSettings {
  readonly id?: string;
  readonly instructions?: string;
  readonly prepareStep?: NinaPrepareStep;
  readonly stopWhen?: unknown;
  readonly tools?: NinaToolSet;
}

interface CapturedStreamOptions {
  readonly messages: ModelMessage[];
  readonly timeout?: unknown;
}

interface CapturedMessageStreamOptions {
  readonly messageMetadata?: (input: {
    readonly part: TextStreamPart<NinaToolSet>;
  }) => MyMetadata | undefined;
  readonly onError?: (error: unknown) => string;
}

interface FakeAgentState {
  deltaMetadata?: MyMetadata;
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
        initialInstructions: fakeAgentState.settings.instructions,
        initialMessages: options.messages,
        instructions: fakeAgentState.settings.instructions,
        messages: options.messages,
        model: "google/gemini-3-flash",
        responseMessages: [],
        runtimeContext: {},
        stepNumber: 0,
        steps: [],
        toolsContext: {},
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
        stream: new ReadableStream(),
      });
    }
  }

  /** Captures stream metadata callbacks without opening an SSE stream. */
  function fakeToUIMessageStream(streamOptions: CapturedMessageStreamOptions) {
    fakeAgentState.startMetadata = streamOptions.messageMetadata?.({
      part: { type: "start" },
    });
    fakeAgentState.deltaMetadata = streamOptions.messageMetadata?.({
      part: { id: "text-1", text: "ignored", type: "text-delta" },
    });
    fakeAgentState.finishMetadata = streamOptions.messageMetadata?.({
      part: {
        finishReason: "stop",
        rawFinishReason: "stop",
        totalUsage: createUsage(),
        type: "finish",
      },
    });
    fakeAgentState.streamErrorMessage = streamOptions.onError?.(
      new Error("stream failed")
    );

    return new ReadableStream();
  }

  return {
    ...actual,
    toUIMessageStream: fakeToUIMessageStream,
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
const placementProgramKey = LearningProgramKeySchema.make(
  "cambridge-lower-secondary"
);

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
    programKey: placementProgramKey,
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
      programKey: placementProgramKey,
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
} satisfies NinaPage;

const runtime = {
  currentDate: "June 21, 2026",
  modelId,
} satisfies NinaRuntime;

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
} satisfies NinaUser;

const chat = {
  finalMessages: [
    {
      content: [{ text: "Explain this page.", type: "text" }],
      role: "user",
    },
  ],
} satisfies { readonly finalMessages: ModelMessage[] };

describe("nina/agent", () => {
  beforeEach(() => {
    fakeAgentState.deltaMetadata = undefined;
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

  it("uses pinned learning context when the current route is not a learning asset", () => {
    const pinnedContext = {
      ...ninaContext,
      snapshot: {
        ...ninaContext.snapshot,
        source: "pinned-chat",
      },
      transition: {
        reason: "same-context",
        toContextKey:
          "placement:cambridge-lower-secondary:curriculum:vector:addition:subjects/mathematics/vector/addition",
      },
    } satisfies NinaContextPack;
    const context = createNinaAgentContext({
      page: {
        locale: "en",
        needsFetch: true,
        nina: pinnedContext,
        slug: "chat/abc123",
        url: "https://nakafa.com/en/chat/abc123",
        verified: false,
      },
      runtime,
      user,
    });

    expect(context).toMatchObject({
      needsPageFetch: true,
      slug: "subjects/mathematics/vector/addition",
      url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
      verified: true,
    });
    expect(context.nina?.snapshot.source).toBe("pinned-chat");
  });

  it("preserves selected learning profile context without inventing a user role", () => {
    const learningProfile = {
      interests: ["exam-prep"],
      planItems: [],
      program: {
        coverageStatus: "partial",
        key: LearningProgramKeySchema.make("snbt-2026"),
        kind: "admission-exam",
        title: "SNBT 2026",
        versionLabel: "2026",
      },
    } satisfies NinaUser["learningProfile"];
    const context = createNinaAgentContext({
      page,
      runtime,
      user: {
        ...user,
        learningProfile,
        role: undefined,
      },
    });

    expect(context.learningProfile).toEqual(learningProfile);
    expect(context.userRole).toBeUndefined();
  });

  it("runs the ToolLoopAgent lifecycle with Nina metadata and adapter-owned tools", async () => {
    const writer = {
      merge: vi.fn(),
      onError: undefined,
      write: vi.fn(),
    } satisfies UIMessageStreamWriter<MyUIMessage>;
    const tools = createTools();
    const onStreamError = vi.fn();
    const responseMessages = await Effect.runPromise(
      runNinaAgentTurn({
        messages: chat.finalMessages,
        page,
        runtime,
        settings: {
          experimental_repairToolCall: () =>
            Effect.runPromise(Effect.succeed(null)),
          tools,
        },
        stream: {
          formatError: () => "translated stream error",
          onError: onStreamError,
          readFinishMetadata: () => ({
            credits: 2,
            model: modelId,
            tokens: { input: 4, output: 6, total: 10 },
          }),
          writer,
        },
        user,
      })
    );

    expect(fakeAgentState.settings?.id).toBe("nina");
    expect(fakeAgentState.settings?.instructions).toContain("Vector Addition");
    expect(fakeAgentState.settings?.tools).toBe(tools);
    expect(fakeAgentState.streamOptions?.messages).toEqual(chat.finalMessages);
    expect(writer.merge).toHaveBeenCalledOnce();
    expect(onStreamError).toHaveBeenCalledWith(
      expect.any(Error),
      "toUIMessageStream"
    );
    expect(fakeAgentState.streamErrorMessage).toBe("translated stream error");
    expect(fakeAgentState.startMetadata).toMatchObject({
      model: modelId,
      ninaContextSnapshot: ninaContext.snapshot,
    });
    expect(fakeAgentState.deltaMetadata).toBeUndefined();
    expect(fakeAgentState.finishMetadata).toMatchObject({
      model: modelId,
      ninaContextTransition: ninaContext.transition,
      tokens: { input: 4, output: 6, total: 10 },
    });
    expect(responseMessages).toEqual([
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
        messages: chat.finalMessages,
        page,
        runtime,
        settings: createSettings(),
        stream: createStream(),
        user,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(readExitFailure(exit)).toBeInstanceOf(NinaAgentError);
  });

  it("keeps ToolLoopAgent response failures in the Effect error channel", async () => {
    fakeAgentState.responseFailure = new Error("response failed");

    const exit = await Effect.runPromiseExit(
      runNinaAgentTurn({
        messages: chat.finalMessages,
        page,
        runtime,
        settings: createSettings(),
        stream: createStream(),
        user,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(readExitFailure(exit)).toBeInstanceOf(NinaAgentError);
  });
});

/** Extracts the typed Effect failure from an Exit for Nina agent assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}

/** Creates the minimal AI SDK settings needed to exercise Nina's package Module. */
function createSettings() {
  return {
    experimental_repairToolCall: () => Effect.runPromise(Effect.succeed(null)),
    tools: createTools(),
  };
}

/** Creates the minimal stream callbacks needed to exercise Nina's package Module. */
function createStream() {
  const writer = {
    merge: vi.fn(),
    onError: undefined,
    write: vi.fn(),
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return {
    formatError: () => "translated stream error",
    onError: vi.fn(),
    readFinishMetadata: () => ({
      credits: 2,
      model: modelId,
      tokens: { input: 4, output: 6, total: 10 },
    }),
    writer,
  };
}

/** Creates the minimal AI SDK Nina tool set required by the step policy. */
function createTools() {
  return {
    deepResearch: tool({
      inputSchema: researchToolInputSchema,
      outputSchema: textOutputSchema,
    }),
    nakafa: tool({
      inputSchema: nakafaToolInputSchema,
      outputSchema: textOutputSchema,
    }),
  };
}
