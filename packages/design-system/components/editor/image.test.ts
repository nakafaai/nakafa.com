import { describe, expect, it } from "@effect/vitest";
import {
  altText,
  imageRefusal,
} from "@repo/design-system/components/editor/image";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { Option } from "effect";

describe("imageRefusal", () => {
  it("takes a PNG, JPEG, WebP, or GIF file of the byte limit or less", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(imageRefusal({ size: IMAGE_BYTE_LIMIT, type })).toEqual(
        Option.none()
      );
    }
  });

  it("refuses a file of another type, whatever its size", () => {
    expect(imageRefusal({ size: 10, type: "image/svg+xml" })).toEqual(
      Option.some("type")
    );
  });

  it("refuses a file over the byte limit", () => {
    expect(
      imageRefusal({ size: IMAGE_BYTE_LIMIT + 1, type: "image/png" })
    ).toEqual(Option.some("size"));
  });
});

describe("altText", () => {
  it("keeps the text without the spaces around it", () => {
    expect(altText("  Segitiga siku-siku  ")).toEqual(
      Option.some("Segitiga siku-siku")
    );
  });

  it("refuses a text that is blank, because the contract requires alt text", () => {
    expect(altText("   ")).toEqual(Option.none());
    expect(altText("")).toEqual(Option.none());
  });
});
