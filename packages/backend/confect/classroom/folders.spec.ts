import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { FolderLimit } from "@repo/backend/confect/classroom/errors";
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

/**
 * The folders of a class library (ADR 0025): one level, oldest first. Whoever reads the library reads them, and its
 * teachers add, rename and remove them. A removed folder leaves its items in the library, at its top.
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
      args: () => ({ ...classArgs, clientKey: ClientKey, name: FolderName }),
      returns: () => FolderView,
      error: () => Schema.Union([AccessDenied, FolderLimit]),
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        ...classArgs,
        folderId: Id("classroomFolders"),
        name: FolderName,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ ...classArgs, folderId: Id("classroomFolders") }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "library.manage", arg: "classId" })
  );
