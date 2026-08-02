// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { readContent } from "@repo/backend/client/content/read";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TryoutAnswerSelector,
  TryoutQuestionSelector,
} from "@/components/tryout/content/model";
import {
  loadSignedAnswers,
  loadSignedQuestions,
  readSignedContent,
} from "@/components/tryout/content/signed";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const keysMock = vi.hoisted(() => vi.fn());
const readMock = vi.hoisted(() => vi.fn());
const registryMock = vi.hoisted(() => vi.fn());
const rendererMock = vi.hoisted(() => vi.fn());
const liveRenderer = await Effect.runPromise(rendererManifest);
const snapshotId = Sha256HashSchema.make(`sha256:${"e".repeat(64)}`);
const artifactHash = Sha256HashSchema.make(`sha256:${"f".repeat(64)}`);
const artifact = {
  artifactHash,
  payload: { rendererDomain: "mathematics" },
};
const selectorBase: Omit<TryoutQuestionSelector, "delivery"> = {
  artifactHash,
  contentHash: "technical-content-hash",
  contentKey: "question-bank/tryout/technical/question-1/question",
  locale: "en",
  questionOrder: 1,
  snapshotId,
  sourcePath: "packages/corpus/question-bank/tryout/technical/question-1",
  sourceRevision: "technical-revision",
};
const question: TryoutQuestionSelector = {
  ...selectorBase,
  delivery: "authenticated",
};
const answer: TryoutAnswerSelector = {
  ...selectorBase,
  delivery: "entitled",
};

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@repo/backend/client/content/read", () => ({
  readContent: readMock,
}));
vi.mock("@repo/backend/content/verify", () => ({
  verifyContentRenderer: rendererMock,
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: keysMock,
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://content.example.test" },
}));
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: executeMock,
}));
vi.mock("@/lib/content/renderer/components", () => ({
  getRendererComponents: registryMock,
}));

/** Technical rendered body returned after artifact verification. */
function Content() {
  return <p>Signed body</p>;
}

/** Builds the protected runtime response used by the loader boundary. */
function protectedFound(delivery: "authenticated" | "entitled") {
  return {
    artifact,
    delivery,
    rendererManifest: liveRenderer,
    snapshotId,
  };
}

describe("tryout signed content", () => {
  beforeEach(() => {
    cacheLifeMock.mockReset();
    cacheTagMock.mockReset();
    executeMock
      .mockReset()
      .mockImplementation(() =>
        ContentVerificationKeyResolver.pipe(Effect.as({ artifact, Content }))
      );
    keysMock.mockReset().mockReturnValue({
      CONTENT_RUNTIME_TOKEN: "runtime-token",
    });
    readMock
      .mockReset()
      .mockReturnValue(Effect.succeed(protectedFound("authenticated")));
    registryMock.mockReset().mockReturnValue({});
    rendererMock.mockReset().mockReturnValue(Effect.void);
  });

  it("renders an authenticated question through its signed artifact", async () => {
    const content = await loadSignedQuestions([question]);

    expect(renderToStaticMarkup(content[0]?.content)).toBe(
      "<p>Signed body</p>"
    );
    expect(content[0]).toMatchObject({
      contentHash: question.contentHash,
      sourcePath: question.sourcePath,
      sourceRevision: question.sourceRevision,
    });
    expect(readContent).toHaveBeenCalledWith(
      {
        siteUrl: "https://content.example.test",
        token: "runtime-token",
      },
      question
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:question",
      `content-artifact:${artifactHash}`
    );
  });

  it("renders an entitled answer without changing its attempt identity", async () => {
    readMock.mockReturnValue(Effect.succeed(protectedFound("entitled")));

    const content = await loadSignedAnswers([answer]);

    expect(renderToStaticMarkup(content[0]?.answer)).toBe("<p>Signed body</p>");
    expect(content[0]).toMatchObject({
      contentHash: answer.contentHash,
      sourcePath: answer.sourcePath,
      sourceRevision: answer.sourceRevision,
    });
    expect(verifyContentRenderer).toHaveBeenCalledWith({
      found: protectedFound("entitled"),
      rendererManifest: liveRenderer,
    });
    expect(executeSignedArtifact).toHaveBeenCalledWith({
      artifact,
      components: expect.any(Object),
      rendererContractVersion: "1.0.0",
      rendererManifest: liveRenderer,
    });
  });

  it("fails closed when protected transport returns public delivery", async () => {
    readMock.mockReturnValue(
      Effect.succeed({ ...protectedFound("authenticated"), delivery: "public" })
    );

    await expect(
      Effect.runPromise(readSignedContent(question).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ContentRuntimeVerificationError",
    });
  });

  it("reports missing runtime configuration before transport", async () => {
    keysMock.mockImplementation(() => {
      throw new Error("missing runtime token");
    });

    await expect(
      Effect.runPromise(readSignedContent(question).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ContentRuntimeConfigurationError",
      key: "CONTENT_RUNTIME_TOKEN",
    });
    expect(readContent).not.toHaveBeenCalled();
  });
});
