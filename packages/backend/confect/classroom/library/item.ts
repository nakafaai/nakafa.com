import { isHttpsUrl } from "@nakafa/aksara-contracts/text/syntax";
import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { ImageType } from "@repo/editor/upload";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The title of a library item: one trimmed line of 1 to 120 characters. */
export const LibraryTitle = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(120)
);

/**
 * The address of a link in the library: an absolute https address of at most
 * 2,048 characters. A large video and a Nakafa page are links.
 */
export const LinkAddress = Schema.String.check(
  Schema.isMaxLength(2048),
  Schema.makeFilter(
    (address) => isHttpsUrl(address) || "Expected an https address."
  )
);

/** The kinds of file the library keeps, which a file's leading bytes name: a PDF, or an image the editor draws. */
export const LibraryFileType = Schema.Union([
  ImageType,
  Schema.Literal("application/pdf"),
]);

/** What a row holds whatever it is: its class, its author, and its title sealed with the school key. */
const itemFields = {
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  sealedTitle: Sealed,
  tenantId: Id("tenants"),
};

/**
 * One item of a class library (ADR 0025): a link, whose address is sealed with
 * the school key, or a file in Convex storage, whose type the server read from
 * its leading bytes. The bytes of a file are not sealed (ADR 0028). Both bind
 * their sealed fields to the class and the client key of their creation, so a
 * repeated add writes once.
 */
export const libraryValidator = Schema.Union([
  Schema.Struct({
    ...itemFields,
    kind: Schema.Literal("link"),
    sealedAddress: Sealed,
  }),
  Schema.Struct({
    ...itemFields,
    byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
    contentType: LibraryFileType,
    kind: Schema.Literal("file"),
    storageId: Id("_storage"),
  }),
]);

/** What an item is as the library shows it: a link, a PDF, or an image. */
export const LibraryKind = Schema.Literals(["link", "pdf", "image"]);

/**
 * One item as the library shows it: what it is, its title, its author, when it
 * was added, and where it opens. A file's address is read for each reader after
 * the access check and is never stored (ADR 0028); a file that storage no
 * longer holds has none.
 */
export const LibraryView = Schema.Struct({
  address: Schema.NullOr(Schema.String),
  author: Schema.String,
  byteSize: Schema.NullOr(Schema.Int),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  id: Id("classroomLibrary"),
  kind: LibraryKind,
  title: Schema.String,
});

/** A sealed field of a library item, bound to the row that names it (ADR 0030). */
export const libraryField = (
  row: Pick<typeof libraryValidator.Type, "classId" | "clientKey">,
  field: "sealedAddress" | "sealedTitle"
) => ({
  field,
  row: [row.classId, row.clientKey],
  table: "classroomLibrary",
});
