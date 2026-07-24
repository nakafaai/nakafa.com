// @vitest-environment node

import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderPublishedAiDs,
  renderPublishedBiology,
  renderPublishedPhysics,
} from "@/lib/content/published/generic";
import {
  readPublishedMaterial,
  renderPublishedMaterial,
} from "@/lib/content/published/material";

const applyCacheMock = vi.hoisted(() => vi.fn());
const dataMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const aiDsComponents = vi.hoisted(() => ({}));
const biologyComponents = vi.hoisted(() => ({}));
const physicsComponents = vi.hoisted(() => ({}));
const input = {
  locale: "en" as const,
  publicPath: "subjects/biology/cells/cell",
};
const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const metadata = {
  authors: [{ name: "Nakafa" }],
  date: "2026-07-23",
  title: "Published material",
};
const route = { publicPath: input.publicPath };
const data = {
  artifact: { artifactHash },
  metadata,
  rendererManifest: { rendererContractVersion: "1.0.0" },
  route,
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/design-system/lib/markdown/domain/ai-ds", () => ({
  aiDsComponents,
}));
vi.mock("@repo/design-system/lib/markdown/domain/biology", () => ({
  biologyComponents,
}));
vi.mock("@repo/design-system/lib/markdown/domain/physics", () => ({
  physicsComponents,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: dataMock,
  renderPublishedMaterial: renderMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedContentCache: applyCacheMock,
}));

beforeEach(() => {
  applyCacheMock.mockReset();
  dataMock.mockReset();
  renderMock.mockReset();
  dataMock.mockReturnValue(Effect.succeed(data));
  renderMock.mockReturnValue(
    Effect.succeed({
      body: <h2>Published material</h2>,
      metadata,
      rawMdx: "",
      route,
    })
  );
});

describe("published generic material renderers", () => {
  it.each([
    ["ai-ds", aiDsComponents, renderPublishedAiDs],
    ["biology", biologyComponents, renderPublishedBiology],
    ["physics", physicsComponents, renderPublishedPhysics],
  ] as const)("caches and renders %s through only its physical registry", async (rendererDomain, components, renderPublished) => {
    const content = await renderPublished(input);

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Published material</h2>"
    );
    expect(readPublishedMaterial).toHaveBeenCalledWith(input);
    expect(renderPublishedMaterial).toHaveBeenCalledWith({
      components,
      data,
      rendererDomain,
    });
    expect(applyCacheMock).toHaveBeenCalledWith("material", artifactHash);
  });
});
