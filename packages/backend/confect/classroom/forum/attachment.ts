import { Id } from "@repo/backend/confect/_generated/id";
import { fileTypeOf } from "@repo/backend/confect/classroom/library/file";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import {
  Array as Arr,
  Option,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

/** The most files one message holds. */
export const ATTACHMENT_LIMIT = 10;

/**
 * The most bytes of a photo's small copy, which a chat shows in its stream: the
 * browser makes it 480 pixels wide, so an honest one stays far under this.
 */
export const THUMBNAIL_BYTE_LIMIT = 256 * 1024;

/** The leading bytes of a ZIP file, which a Word, Excel or PowerPoint file of today is. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** The leading bytes of an older Word, Excel or PowerPoint file. */
const COMPOUND_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];

/** The office documents a message carries, by the extension of their name, each with the bytes it opens with. */
const OFFICE_TYPES = Rec.fromEntries([
  ["doc", { signature: COMPOUND_SIGNATURE, type: "application/msword" }],
  [
    "docx",
    {
      signature: ZIP_SIGNATURE,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ],
  [
    "ppt",
    { signature: COMPOUND_SIGNATURE, type: "application/vnd.ms-powerpoint" },
  ],
  [
    "pptx",
    {
      signature: ZIP_SIGNATURE,
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  ],
  ["xls", { signature: COMPOUND_SIGNATURE, type: "application/vnd.ms-excel" }],
  [
    "xlsx",
    {
      signature: ZIP_SIGNATURE,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ],
]);

/** The name of a file that a message carries: one trimmed line of 1 to 160 characters. */
export const AttachmentName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(160)
);

/** Whether a message shows a file as a picture or as a document to open. */
export const AttachmentKind = Schema.Literals(["document", "image"]);

/**
 * The type of file that the leading bytes and the name of a file name: an image
 * or a PDF by its bytes alone, or an office document whose bytes match the
 * extension of its name. Any other file has none, whatever its declared type says.
 */
export const attachmentTypeOf = (head: Uint8Array, name: string) =>
  Option.orElse(fileTypeOf(head), () =>
    Option.map(
      Option.filter(
        Option.flatMap(Arr.last(Str.split(name, ".")), (extension) =>
          Rec.get(OFFICE_TYPES, Str.toLowerCase(extension))
        ),
        (office) =>
          Arr.every(office.signature, (value, index) => head[index] === value)
      ),
      (office) => office.type
    )
  );

/**
 * One file that a message carries, or that its author uploaded for the next
 * message. Its name is sealed with the school key and bound to the class and the
 * file (ADR 0030); its bytes are not sealed (ADR 0028). A photo holds the small
 * copy a chat shows in its stream, and its size in pixels, so its place in the
 * stream never moves when it loads.
 */
export const attachmentValidator = Schema.Struct({
  byteSize: Schema.Int,
  contentType: Schema.String,
  height: Schema.optionalKey(Schema.Int),
  kind: AttachmentKind,
  sealedName: Sealed,
  storageId: Id("_storage"),
  thumbnailId: Schema.optionalKey(Id("_storage")),
  width: Schema.optionalKey(Schema.Int),
});

/** A file its author uploaded and has not sent yet. A daily sweep deletes one that stays unsent. */
export const uploadValidator = Schema.Struct({
  ...attachmentValidator.fields,
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  createdAt: Schema.Finite,
  tenantId: Id("tenants"),
});

/** One file of a message as the forum shows it, each address read for this read alone (ADR 0028). */
export const AttachmentView = Schema.Struct({
  address: Schema.NullOr(Schema.String),
  byteSize: Schema.Int,
  height: Schema.NullOr(Schema.Int),
  kind: AttachmentKind,
  name: Schema.String,
  thumbnail: Schema.NullOr(Schema.String),
  width: Schema.NullOr(Schema.Int),
});

/** The sealed field of a file's name, bound to its class and its file, wherever the row that holds it stands. */
export const attachmentField = (
  row: Pick<typeof uploadValidator.Type, "classId" | "storageId">
) => ({
  field: "sealedName",
  row: [row.classId, row.storageId],
  table: "classroomUploads",
});
