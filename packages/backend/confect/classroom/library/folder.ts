import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The most folders one class library holds, every level and the trash counted. */
export const FOLDER_LIMIT = 500;

/** The name of a folder: one trimmed line of 1 to 80 characters. */
export const FolderName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/**
 * One folder of a class library (ADR 0025), inside another folder or at the top, at any depth, with its name
 * sealed with the school key and bound to the class and the client key of its creation, so a repeated add writes
 * once. A folder in the trash hides everything inside it until it is restored or deleted forever.
 */
export const folderValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  parentId: Schema.optionalKey(Id("classroomFolders")),
  sealedName: Sealed,
  tenantId: Id("tenants"),
  trashedAt: Schema.optionalKey(Schema.Finite),
});

/** One folder as the library shows it, with the folder it sits in, the reader's star, and its time in the trash. */
export const FolderView = Schema.Struct({
  author: Schema.String,
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  id: Id("classroomFolders"),
  name: Schema.String,
  parentId: Schema.NullOr(Id("classroomFolders")),
  starred: Schema.Boolean,
  trashedAt: Schema.NullOr(Schema.Finite),
});

/** The sealed name of a folder, bound to the row that names it (ADR 0030). */
export const folderField = (
  row: Pick<typeof folderValidator.Type, "classId" | "clientKey">
) => ({
  field: "sealedName",
  row: [row.classId, row.clientKey],
  table: "classroomFolders",
});
