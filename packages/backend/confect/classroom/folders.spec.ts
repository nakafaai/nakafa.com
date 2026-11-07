import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  FolderCycle,
  FolderLimit,
} from "@repo/backend/confect/classroom/errors";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import {
  FolderName,
  FolderView,
} from "@repo/backend/confect/classroom/library/folder";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The class and school that every function of the folders names. */
const classArgs = { classId: Id("classes"), slug: TenantSlug };

/** The folder a call names. */
const folderArg = { folderId: Id("classroomFolders") };

/** The folder a folder sits in, or none for the top of the library. */
const parentArg = { parentId: Schema.NullOr(Id("classroomFolders")) };

/**
 * The folders of a class library (ADR 0025), at any depth, oldest first, the trash included so the reader builds
 * the whole tree, its breadcrumbs, and its trash at once. Whoever reads the library reads them; whoever may manage
 * it adds, renames, moves, trashes, restores, and deletes them forever with everything inside them.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => classArgs,
      returns: () => Schema.Array(FolderView),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "add",
      args: () => ({
        ...classArgs,
        ...parentArg,
        clientKey: ClientKey,
        name: FolderName,
      }),
      returns: () => FolderView,
      error: () => Schema.Union([AccessDenied, FolderLimit]),
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({ ...classArgs, ...folderArg, name: FolderName }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "move",
      args: () => ({ ...classArgs, ...folderArg, ...parentArg }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, FolderCycle]),
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "trash",
      args: () => ({ ...classArgs, ...folderArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "restore",
      args: () => ({ ...classArgs, ...folderArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "purge",
      args: () => ({ ...classArgs, ...folderArg }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  );
