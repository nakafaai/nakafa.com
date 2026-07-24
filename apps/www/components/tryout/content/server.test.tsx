// @vitest-environment node

import { testSignedArtifact } from "@repo/backend/test/content-proof";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTryoutContent } from "@/components/tryout/content/server";

const readMock = vi.hoisted(() => vi.fn());
const registryMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const components = vi.hoisted(() => ({}));
const manifest = vi.hoisted(() => ({
  rendererContractVersion: "1.0.0",
}));
const route = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  sectionKey: "penalaran-matematika",
  setKey: "set-1",
  trackKey: "2027",
} as const;

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    CONTENT_RUNTIME_TOKEN: "runtime-token",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  },
}));
vi.mock("@repo/backend/client/content/tryout", () => ({
  readTryoutContent: readMock,
}));
vi.mock("@/components/tryout/content/registry", () => ({
  resolveTryoutComponents: registryMock,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(manifest),
}));
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: executeMock,
}));

beforeEach(() => {
  readMock.mockReset();
  registryMock.mockReset();
  executeMock.mockReset();
  registryMock.mockReturnValue(Effect.succeed(components));
  executeMock.mockImplementation(({ artifact }) =>
    Effect.succeed({
      /** Renders the artifact identity for server-boundary assertions. */
      Content: () => <p>{artifact.payload.contentKey}</p>,
    })
  );
});

describe("try-out published content server", () => {
  it("renders placement-bound questions and terminal answers", async () => {
    const questionOne = testSignedArtifact("snbt-math", {
      contentKey: "question-bank/tryout/one/question",
    });
    const answerOne = testSignedArtifact("snbt-math", {
      contentKey: "question-bank/tryout/one/answer",
    });
    const questionTwo = testSignedArtifact("snbt-math", {
      contentKey: "question-bank/tryout/two/question",
    });
    readMock.mockReturnValue(
      Effect.succeed({
        artifacts: [
          {
            answerArtifact: answerOne,
            placementId: "placement-1",
            questionArtifact: questionOne,
          },
          {
            placementId: "placement-2",
            questionArtifact: questionTwo,
          },
        ],
        kind: "found",
      })
    );

    const result = await Effect.runPromise(
      loadTryoutContent("user-jwt", route)
    );

    expect(result.questions.map(({ placementId }) => placementId)).toEqual([
      "placement-1",
      "placement-2",
    ]);
    expect(result.answers.map(({ placementId }) => placementId)).toEqual([
      "placement-1",
    ]);
    expect(renderToStaticMarkup(result.questions[0]?.content)).toContain(
      questionOne.payload.contentKey
    );
    expect(renderToStaticMarkup(result.answers[0]?.answer)).toContain(
      answerOne.payload.contentKey
    );
    expect(readMock).toHaveBeenCalledWith(
      {
        siteUrl: "https://example.convex.site",
        token: "runtime-token",
        userToken: "user-jwt",
      },
      route
    );
    expect(registryMock).toHaveBeenCalledTimes(3);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        components,
        rendererContractVersion: manifest.rendererContractVersion,
      })
    );
  });

  it("returns exact empty content when the owned attempt is unavailable", async () => {
    readMock.mockReturnValue(Effect.succeed(null));

    await expect(
      Effect.runPromise(loadTryoutContent("user-jwt", route))
    ).resolves.toEqual({
      answers: [],
      questions: [],
    });
    expect(registryMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });
});
