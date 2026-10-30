import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  FileSizeRefused,
  FileTypeRefused,
} from "@repo/backend/confect/classroom/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import {
  LibraryFileType,
  LibraryTitle,
  LibraryView,
  LinkAddress,
} from "@repo/backend/confect/classroom/library/item";
import {
  ConnectorOff,
  GoogleFailed,
} from "@repo/backend/confect/connectors/errors";
import { DriveFileId } from "@repo/backend/confect/connectors/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The class and school that every public function of the library names. */
const classArgs = { classId: Id("classes"), slug: TenantSlug };

/**
 * The library of a class (ADR 0025): links and files that its subject teachers
 * add, which whoever reads the forum reads, newest first. A file goes to the
 * upload address first and is then registered: the server reads its size and
 * leading bytes, keeps only a PDF or an image, and deletes any other file. The
 * address of a file is read after the access check of each read (ADR 0028). A
 * teacher may also import a file picked in Google Drive, which the server reads
 * with the teacher's own Drive connection and checks the same way.
 * `commit` is internal: only the registration calls it.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => classArgs,
      item: () => LibraryView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addLink",
      args: () => ({
        ...classArgs,
        address: LinkAddress,
        clientKey: ClientKey,
        title: LibraryTitle,
      }),
      returns: () => LibraryView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "uploadUrl",
      args: () => classArgs,
      returns: () => Schema.URLFromString,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "canAdd",
      args: () => classArgs,
      returns: () => Schema.Struct({ authorId: Id("tenantPeople") }),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "register",
      args: () => ({
        ...classArgs,
        clientKey: ClientKey,
        storageId: Id("_storage"),
        title: LibraryTitle,
      }),
      returns: () => Schema.Struct({ id: Id("classroomLibrary") }),
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          FileSizeRefused,
          FileTypeRefused,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "importDrive",
      args: () => ({
        ...classArgs,
        clientKey: ClientKey,
        fileId: DriveFileId,
        title: LibraryTitle,
      }),
      returns: () => Schema.Struct({ id: Id("classroomLibrary") }),
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          ConnectorOff,
          FileSizeRefused,
          FileTypeRefused,
          GoogleFailed,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ ...classArgs, itemId: Id("classroomLibrary") }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({
        authorId: Id("tenantPeople"),
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        classId: Id("classes"),
        clientKey: ClientKey,
        contentType: LibraryFileType,
        storageId: Id("_storage"),
        title: LibraryTitle,
      }),
      returns: () => Schema.Struct({ id: Id("classroomLibrary") }),
    })
  );
