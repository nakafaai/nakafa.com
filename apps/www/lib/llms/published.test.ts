// @vitest-environment node

import { readFile } from "node:fs/promises";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { getCachedPublishedMaterialText } from "@/lib/llms/published";
import {
  previewMetadata,
  previewPublicRoute,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readMaterialMock = vi.hoisted(() => vi.fn());
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const functionRoot = new URL(
  "../../../../packages/contents/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx",
  import.meta.url
);
const functionSource = await readFile(functionRoot, "utf8");
const rawMdx = functionSource.slice(functionSource.indexOf("\n\n") + 2);
const data = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: {
    ...previewWireArtifact,
    payload: {
      ...previewWireArtifact.payload,
      rawMdx,
    },
  },
  metadata: previewMetadata,
  rendererManifest: liveRenderer,
  route: previewPublicRoute,
  sourcePath: previewSourcePath,
  sourceRevision,
};
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: readMaterialMock,
}));
beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readMaterialMock.mockReset();
  readMaterialMock.mockReturnValue(Effect.succeed(data));
});

describe("published llms markdown", () => {
  it("projects verified source with immutable provenance and exact cache tags", async () => {
    const text = await getCachedPublishedMaterialText({
      activeReleaseId: data.activeReleaseId,
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).toContain(previewMetadata.description);
    expect(text).toContain("What is a Function?");
    expect(text).toContain("Component: FunctionMachine");
    expect(text).toContain(
      `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
    );
    expect(readPublishedMaterial).toHaveBeenCalledWith({
      activeReleaseId: data.activeReleaseId,
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      `content-artifact:${data.artifact.artifactHash}`
    );
  });

  it("omits source links for rollback state without an exact Git revision", async () => {
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({ ...data, sourceRevision: null })
    );
    const text = await getCachedPublishedMaterialText({
      activeReleaseId: data.activeReleaseId,
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).not.toContain("Source:");
  });

  it("preserves real source when semantic projection cannot parse it", async () => {
    const incompleteMdx = `${rawMdx}\n{`;
    readMaterialMock.mockReturnValueOnce(
      Effect.succeed({
        ...data,
        artifact: {
          ...data.artifact,
          payload: { ...data.artifact.payload, rawMdx: incompleteMdx },
        },
      })
    );
    const text = await getCachedPublishedMaterialText({
      activeReleaseId: data.activeReleaseId,
      locale: "en",
      publicPath: previewPublicRoute.publicPath,
    });

    expect(text).toContain("What is a Function?");
  });
});
