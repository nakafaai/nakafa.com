import { Id } from "@repo/backend/confect/_generated/id";
import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** The most bytes one image of an exam may hold: 2 MB, which the editor tells the teacher. */
export const ASSET_BYTE_LIMIT = 2 * 1024 * 1024;

/** The most images one call of `urls` reads: the images of one prompt, in one call. */
export const MAX_ASSET_READS = 64;

/** The kinds of image that an exam holds, which the server reads from the file's leading bytes. */
export const ImageType = Schema.Literals([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

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

/** A file over `ASSET_BYTE_LIMIT`. The file is deleted. */
export class AssetSizeRefused extends Schema.TaggedError<AssetSizeRefused>()(
  "AssetSizeRefused",
  {
    ...refusal("ASSET_SIZE", "An image may be at most 2 MB."),
  }
) {}
