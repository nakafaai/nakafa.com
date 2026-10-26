import { Id } from "@repo/backend/confect/_generated/id";
import { refusal } from "@repo/backend/confect/tenancy/errors";
import { ImageType } from "@repo/editor/upload";
import { Schema } from "effect";

/** The most images one call of `urls` or `images` reads: the images of one prompt, in one call. */
export const MAX_ASSET_READS = 64;

/** The stored fields of one image of an exam, which the document refers to by its ID (ADR 0031). */
export const examAssetValidator = Schema.Struct({
  byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
  contentType: ImageType,
  createdAt: Schema.Finite,
  createdBy: Id("users"),
  examId: Id("exams"),
  height: Schema.Int.check(Schema.isGreaterThan(0)),
  storageId: Id("_storage"),
  tenantId: Id("tenants"),
  width: Schema.Int.check(Schema.isGreaterThan(0)),
});

/** The address of one image of an exam, which a prompt or an option draws. */
export const AssetAddress = Schema.Struct({
  id: Id("examAssets"),
  url: Schema.String,
});

/** A file whose leading bytes are no image the editor accepts. The file is deleted. */
export class AssetTypeRefused extends Schema.TaggedError<AssetTypeRefused>()(
  "AssetTypeRefused",
  {
    ...refusal(
      "ASSET_TYPE",
      "Only PNG, JPEG, WebP, and GIF images can be added."
    ),
  }
) {}

/** A file over `IMAGE_BYTE_LIMIT`. The file is deleted. */
export class AssetSizeRefused extends Schema.TaggedError<AssetSizeRefused>()(
  "AssetSizeRefused",
  {
    ...refusal("ASSET_SIZE", "An image may be at most 2 MB."),
  }
) {}
