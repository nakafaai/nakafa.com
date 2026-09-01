import { describe, expect, it } from "@effect/vitest";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import { previewMetadata } from "@/test/content-preview";

describe("material metadata", () => {
  it("uses the signed title and description", () => {
    expect(toMaterialMetadataCopy({ metadata: previewMetadata })).toEqual({
      description: previewMetadata.description,
      title: previewMetadata.title,
    });
  });

  it("falls back from description to subject and title", () => {
    expect(
      toMaterialMetadataCopy({
        metadata: { ...previewMetadata, description: undefined },
      })
    ).toEqual({
      description: previewMetadata.subject,
      title: previewMetadata.title,
    });
    expect(
      toMaterialMetadataCopy({
        metadata: {
          ...previewMetadata,
          description: undefined,
          subject: undefined,
        },
      })
    ).toEqual({
      description: previewMetadata.title,
      title: previewMetadata.title,
    });
  });
});
