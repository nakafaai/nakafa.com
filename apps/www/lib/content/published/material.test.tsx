// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { renderPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  previewMetadata,
  previewPublicRoute,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const executeMock = vi.hoisted(() => vi.fn());
const components = {};
const liveRenderer = await Effect.runPromise(rendererManifest);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const data = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: previewWireArtifact,
  metadata: previewMetadata,
  rendererManifest: liveRenderer,
  route: previewPublicRoute,
  sourcePath: previewSourcePath,
  sourceRevision,
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: executeMock,
}));

beforeEach(() => {
  executeMock.mockReset();
  executeMock.mockImplementation(
    ({ artifact }: { readonly artifact: unknown }) =>
      ContentVerificationKeyResolver.pipe(
        Effect.as({
          artifact,
          /** Represents one already authenticated compiled document. */
          Content: () => <h2>Function Concept</h2>,
        })
      )
  );
});

describe("published material renderer", () => {
  it("returns JSX and plain projections without exposing the module function", async () => {
    const content = await Effect.runPromise(
      renderPublishedMaterial({
        components,
        data,
        rendererDomain: "mathematics",
      })
    );

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Function Concept</h2>"
    );
    expect(content).toMatchObject({
      metadata: previewMetadata,
      rawMdx: previewWireArtifact.payload.rawMdx,
      route: previewPublicRoute,
      sourcePath: previewSourcePath,
      sourceRevision,
    });
    expect(executeSignedArtifact).toHaveBeenCalledWith({
      artifact: previewWireArtifact,
      components,
      rendererContractVersion: "1.0.0",
      rendererManifest: liveRenderer,
    });
    expect("Content" in content).toBe(false);
  });

  it("fails closed before execution for the wrong physical registry", async () => {
    await expect(
      Effect.runPromise(
        renderPublishedMaterial({
          components,
          data,
          rendererDomain: "chemistry",
        })
      )
    ).rejects.toThrow('"rendererDomain": "mathematics"');
    expect(executeMock).not.toHaveBeenCalled();
  });
});
