import { describe, expect, it } from "vitest";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import {
  previewMetadata,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";

describe("material metadata", () => {
  it("derives copy without duplicating owner fallback rules", () => {
    expect(
      toMaterialMetadataCopy({
        metadata: undefined,
        route: previewProjection,
      })
    ).toEqual({
      description: previewProjection.metadata.description,
      title: previewProjection.metadata.title,
    });
    expect(
      toMaterialMetadataCopy({
        metadata: previewMetadata,
        route: previewPublicRoute,
      })
    ).toEqual({
      description: previewMetadata.description,
      title: previewMetadata.title,
    });
    expect(
      toMaterialMetadataCopy({
        metadata: undefined,
        route: { ...previewPublicRoute, description: undefined },
      })
    ).toEqual({
      description: previewPublicRoute.title,
      title: previewPublicRoute.title,
    });
  });
});
