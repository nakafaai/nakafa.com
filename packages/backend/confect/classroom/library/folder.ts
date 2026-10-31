import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The most folders one class library holds. */
export const FOLDER_LIMIT = 100;

/** The name of a folder: one trimmed line of 1 to 80 characters. */
export const FolderName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/**
 * One folder of a class library (ADR 0025): one level, as a chapter of a subject is, with its name sealed with
 * the school key and bound to the class and the client key of its creation, so a repeated add writes once.
 */
export const folderValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  sealedName: Sealed,
  tenantId: Id("tenants"),
});

/** One folder as the library shows it. */
export const FolderView = Schema.Struct({
  author: Schema.String,
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  id: Id("classroomFolders"),
  name: Schema.String,
});

/** The sealed name of a folder, bound to the row that names it (ADR 0030). */
export const folderField = (
  row: Pick<typeof folderValidator.Type, "classId" | "clientKey">
) => ({
  field: "sealedName",
  row: [row.classId, row.clientKey],
  table: "classroomFolders",
});
