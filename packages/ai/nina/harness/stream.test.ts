import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { createNakafaTestService } from "@repo/ai/agents/nakafa/tools/test";
import { ModelIdSchema } from "@repo/ai/config/model";
import type { NinaTurn } from "@repo/ai/nina/contract/turn";
import {
  NinaHarness,
  NinaHarnessInputError,
} from "@repo/ai/nina/harness/stream";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { CasEngine } from "@repo/math/cas/engine";
import { MathWorkRepository } from "@repo/math/reason/repo";
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createNinaStreamResponseMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/ai/nina/runtime/stream", () => ({
  createNinaStreamResponse: createNinaStreamResponseMock,
}));

const modelId = ModelIdSchema.make("nakafa-lite");
const programKey = LearningProgramKeySchema.make("cambridge-lower-secondary");

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
      placement: {
        mode: "placement",
        nodeKey: "curriculum:vector:addition",
        parentHref: "/en/curriculum/mathematics/vector",
        parentTitle: "Vector",
        programKey,
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
        placement: {
          mode: "placement",
          nodeKey: "curriculum:vector:addition",
          parentHref: "/en/curriculum/mathematics/vector",
          parentTitle: "Vector",
          programKey,
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

describe("nina/harness/stream", () => {
  beforeEach(() => {
    createNinaStreamResponseMock.mockReset();
    createNinaStreamResponseMock.mockImplementation((input: NinaTurn) =>
      Effect.succeed(new Response(input.page.slug))
    );
  });

  it("decodes one turn and delegates response creation through the harness Interface", async () => {
    const response = await Effect.runPromise(
      provideHarnessServices(NinaHarness.stream(turn))
    );

    await expect(response.text()).resolves.toBe(
      "/subjects/mathematics/vector/addition"
    );
    expect(createNinaStreamResponseMock).toHaveBeenCalledWith(turn);
  });

  it("rejects invalid route input with a tagged harness error", async () => {
    const exit = await Effect.runPromiseExit(
      provideHarnessServices(NinaHarness.stream({ ...turn, page: undefined }))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit)
      ? Cause.failureOption(exit.cause)
      : Option.none();
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toBeInstanceOf(NinaHarnessInputError);
      expect(failure.value.message).toBe("Invalid Nina harness turn input.");
    }
  });
});

/** Provides the app-owned services required by the default NinaHarness layer. */
function provideHarnessServices<A, E>(
  program: Effect.Effect<A, E, NinaHarness>
) {
  return program.pipe(
    Effect.provide(NinaHarness.Default),
    Effect.provideService(NinaStore, {
      loadMessages: () => Effect.succeed([]),
      saveAssistant: () => Effect.void,
      saveFailure: () => Effect.void,
      saveTrace: () => Effect.void,
      saveTitle: () => Effect.void,
    }),
    Effect.provideService(NinaReporter, {
      report: () => Effect.void,
    }),
    Effect.provideService(Nakafa, createNakafaTestService()),
    Effect.provideService(NakafaSearch, {
      search: () =>
        Effect.dieMessage("Nakafa search is not used in this test."),
    }),
    Effect.provideService(
      CasEngine,
      CasEngine.make({
        capabilities: Effect.succeed([]),
        compute: () => Effect.dieMessage("CAS is not used in this test."),
      })
    ),
    Effect.provideService(MathWorkRepository, {
      save: () => Effect.void,
    })
  );
}
