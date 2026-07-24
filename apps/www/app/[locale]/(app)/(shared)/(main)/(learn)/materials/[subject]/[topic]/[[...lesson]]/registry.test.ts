// @vitest-environment node

import { Either } from "effect";
import { describe, expect, it, vi } from "vitest";
import { resolveGenericMaterialRuntime } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/registry";

const aiDsComponents = vi.hoisted(() => ({}));
const biologyComponents = vi.hoisted(() => ({}));
const physicsComponents = vi.hoisted(() => ({}));
const importAiDsMaterial = vi.hoisted(() => vi.fn());
const importBiologyMaterial = vi.hoisted(() => vi.fn());
const importPhysicsMaterial = vi.hoisted(() => vi.fn());
const renderPublishedAiDs = vi.hoisted(() => vi.fn());
const renderPublishedBiology = vi.hoisted(() => vi.fn());
const renderPublishedPhysics = vi.hoisted(() => vi.fn());

vi.mock("@repo/contents/_lib/material/ai-ds", () => ({
  importAiDsMaterial,
}));
vi.mock("@repo/contents/_lib/material/biology", () => ({
  importBiologyMaterial,
}));
vi.mock("@repo/contents/_lib/material/physics", () => ({
  importPhysicsMaterial,
}));
vi.mock("@repo/design-system/lib/markdown/domain/ai-ds", () => ({
  aiDsComponents,
}));
vi.mock("@repo/design-system/lib/markdown/domain/biology", () => ({
  biologyComponents,
}));
vi.mock("@repo/design-system/lib/markdown/domain/physics", () => ({
  physicsComponents,
}));
vi.mock("@/lib/content/published/generic", () => ({
  renderPublishedAiDs,
  renderPublishedBiology,
  renderPublishedPhysics,
}));

describe("generic material registry selection", () => {
  it.each([
    ["ai-ds", aiDsComponents, importAiDsMaterial, renderPublishedAiDs],
    [
      "biology",
      biologyComponents,
      importBiologyMaterial,
      renderPublishedBiology,
    ],
    [
      "physics",
      physicsComponents,
      importPhysicsMaterial,
      renderPublishedPhysics,
    ],
  ] as const)("selects only the %s route runtime", (rendererDomain, components, importer, published) => {
    expect(resolveGenericMaterialRuntime(rendererDomain)).toEqual(
      Either.right({
        components,
        importer,
        published,
        rendererDomain,
      })
    );
  });

  it("fails closed for a renderer owned by another physical route", () => {
    expect(resolveGenericMaterialRuntime("chemistry")).toMatchObject({
      _tag: "Left",
      left: {
        _tag: "MaterialRegistryMissingError",
        rendererDomain: "chemistry",
      },
    });
  });
});
