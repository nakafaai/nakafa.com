// @vitest-environment node

import { beforeEach } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import {
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedEmptyRelease,
} from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import { makePublishedParts } from "@/test/parts";
import {
  testArticleProjection as projection,
  testArticleSourcePath as sourcePath,
} from "@/test/published/article";

/** The verifier, which answers each test's found response. */
const readMock = vi.hoisted(() => vi.fn());
const headMock = vi.hoisted(() => vi.fn());
const partsMocks = vi.hoisted(() => ({ artifact: vi.fn(), frame: vi.fn() }));
const bodyMock = vi.hoisted(() => vi.fn());
const releaseId = ReleaseIdSchema.make("release-article-domain");
/** Builds the signed article found response that each delivery test reads. */
const makeFound = Effect.fn("test.www.publishedArticle.found")(function* () {
  const release = yield* testSignedEmptyRelease(releaseId);
  const found: PublicContentRuntimeFound = {
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact: yield* testSignedArtifact("politics", {
      contentKey: projection.contentKey,
      rawMdx: "## Article delivery evidence\n\nThe signed article source.",
    }),
    delivery: "public",
    kind: "found",
    projection,
    projectionHash: yield* hashContentProjection(projection),
    release,
    rendererManifest: TEST_PROOF_RENDERER,
    sourcePath,
  };
  return found;
});

vi.mock("@repo/backend/client/content/public", () => ({
  verifyPublicContentFound: readMock,
}));
vi.mock("@/lib/content/store/query", () => ({
  queryContentStore: headMock,
}));
vi.mock("@/lib/content/published/parts", () => ({
  readPublicArtifact: partsMocks.artifact,
  readReleaseFrame: partsMocks.frame,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(TEST_PROOF_RENDERER),
}));
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: bodyMock,
}));

/** The Convex answers that the found response of each test is composed from. */
const parts = () =>
  makeFound().pipe(Effect.map((found) => makePublishedParts(found, "article")));

beforeEach(() => {
  readMock.mockReset().mockImplementation(() => makeFound());
  headMock
    .mockReset()
    .mockImplementation(() => parts().pipe(Effect.map(({ head }) => head)));
  partsMocks.frame
    .mockReset()
    .mockImplementation(() => parts().pipe(Effect.map(({ frame }) => frame)));
  partsMocks.artifact
    .mockReset()
    .mockImplementation(() =>
      parts().pipe(Effect.map(({ artifactJson }) => artifactJson))
    );
  bodyMock.mockReset().mockReturnValue(Effect.succeed("cached-article-body"));
});
