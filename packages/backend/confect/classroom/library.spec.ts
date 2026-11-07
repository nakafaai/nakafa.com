import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  FileSizeRefused,
  FileTypeRefused,
  UploadMissing,
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

/** The folder an item sits in, or none for the top of the library. */
const folderArg = { folderId: Schema.NullOr(Id("classroomFolders")) };

/** The item a call names. */
const itemArg = { itemId: Id("classroomLibrary") };

/** The text a search looks for in the titles: one to 80 characters. */
export const SearchText = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/** What a star names: one item or one folder of the class. */
export const StarTarget = Schema.Union([
  Schema.Struct({
    itemId: Id("classroomLibrary"),
    kind: Schema.Literal("item"),
  }),
  Schema.Struct({
    folderId: Id("classroomFolders"),
    kind: Schema.Literal("folder"),
  }),
]);

/** Refusals of a reservation: the file's size, the school's or the bucket's limit, or the day's free operations. */
const reserveError = () =>
  Schema.Union([AccessDenied, FileSizeRefused, StorageFull]);

/**
 * The library of a class (ADR 0025), a Drive for the classroom: folders at any depth, links, and files kept in the
 * private R2 bucket. Whoever reads the forum reads it; whoever may manage the library adds, renames, moves, stars,
 * trashes, restores, and deletes forever. A file first reserves its bytes, which charges the school's limit and
 * the bucket's before any byte arrives, then the browser uploads it straight to R2 at an address that binds its
 * length and type, then `register` reads its size and leading bytes and keeps only a PDF or an image. A file opens
 * at an address signed for that opening alone (ADR 0028). A teacher may also import a file picked in Google
 * Drive, which the server reads with the teacher's own Drive connection and checks the same way.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ ...classArgs, ...folderArg }),
      item: () => LibraryView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "trashed",
      args: () => classArgs,
      item: () => LibraryView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "starred",
      args: () => classArgs,
      returns: () => Schema.Array(LibraryView),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "search",
      args: () => ({ ...classArgs, text: SearchText }),
      returns: () => Schema.Array(LibraryView),
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
        ...folderArg,
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
      name: "reserve",
      args: () => ({
        ...classArgs,
        ...folderArg,
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        clientKey: ClientKey,
        contentType: LibraryFileType,
        title: LibraryTitle,
      }),
      returns: () =>
        Schema.Struct({
          address: Schema.String,
          uploadId: Id("classroomLibraryUploads"),
        }),
      error: reserveError,
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
        uploadId: Id("classroomLibraryUploads"),
      }),
      returns: () => Schema.Struct({ id: Id("classroomLibrary") }),
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          FileTypeRefused,
          UploadMissing,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "importDrive",
      args: () => ({
        ...classArgs,
        ...folderArg,
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
          StorageFull,
          UploadMissing,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({ ...classArgs, ...itemArg, download: Schema.Boolean }),
      returns: () => Schema.String,
      error: () => Schema.Union([AccessDenied, StorageFull]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        ...classArgs,
        ...folderArg,
        ...itemArg,
        address: Schema.NullOr(LinkAddress),
        title: LibraryTitle,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "move",
      args: () => ({ ...classArgs, ...folderArg, ...itemArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "star",
      args: () => ({
        ...classArgs,
        starred: Schema.Boolean,
        target: StarTarget,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "trash",
      args: () => ({ ...classArgs, ...itemArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "restore",
      args: () => ({ ...classArgs, ...itemArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "purge",
      args: () => ({ ...classArgs, ...itemArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "upload",
      args: () => ({
        classId: Id("classes"),
        uploadId: Id("classroomLibraryUploads"),
      }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            byteSize: Schema.Int,
            classId: Id("classes"),
            contentType: LibraryFileType,
            objectKey: Schema.String,
          })
        ),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reserveImport",
      args: () => ({
        ...folderArg,
        authorId: Id("tenantPeople"),
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        classId: Id("classes"),
        clientKey: ClientKey,
        contentType: LibraryFileType,
        title: LibraryTitle,
      }),
      returns: () =>
        Schema.Struct({
          objectKey: Schema.String,
          uploadId: Id("classroomLibraryUploads"),
        }),
      error: () => Schema.Union([FileSizeRefused, StorageFull]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({ uploadId: Id("classroomLibraryUploads") }),
      returns: () => Schema.Struct({ id: Id("classroomLibrary") }),
      error: () => UploadMissing,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "discard",
      args: () => ({ uploadId: Id("classroomLibraryUploads") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "removeObjects",
      args: () => ({ keys: Schema.Array(Schema.String) }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "purgeRest",
      args: () => ({
        classId: Id("classes"),
        folderIds: Schema.Array(Id("classroomFolders")),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
