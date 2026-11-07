import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { FileSizeRefused } from "@repo/backend/confect/classroom/errors";
import {
  AttachmentKind,
  AttachmentName,
} from "@repo/backend/confect/classroom/forum/attachment";
import { AttachmentRefused } from "@repo/backend/confect/classroom/forum/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The class and school that every public function of a chat's files names. */
const classArgs = { classId: Id("classes"), slug: TenantSlug };

/** A photo's size in pixels. */
const Pixels = Schema.Int.check(
  Schema.isBetween({ maximum: 20_000, minimum: 1 })
);

/** What a registered upload is, which the composer shows until the message goes out. */
const UploadView = Schema.Struct({
  byteSize: Schema.Int,
  id: Id("classroomUploads"),
  kind: AttachmentKind,
});

/**
 * The files of a class's chats (ADR 0025, ADR 0028). Whoever writes in the class
 * reserves each file, which charges the school's bytes before any byte moves,
 * uploads it straight to R2 at the address the reservation answers, then registers
 * it: the server reads its size and leading bytes from R2, keeps a photo, a PDF or
 * an office document, and deletes any other file. A registered file waits for the
 * message that sends it, and a daily sweep deletes one that stays unsent. `commit`
 * and `sweep` are internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reserve",
      args: () => ({
        ...classArgs,
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        contentType: Schema.String,
      }),
      returns: () =>
        Schema.Struct({ address: Schema.String, fileId: Id("bucketFiles") }),
      error: () => Schema.Union([AccessDenied, FileSizeRefused, StorageFull]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "canAttach",
      args: () => classArgs,
      returns: () => Schema.Struct({ authorId: Id("tenantPeople") }),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "register",
      args: () => ({
        ...classArgs,
        height: Schema.NullOr(Pixels),
        fileId: Id("bucketFiles"),
        name: AttachmentName,
        thumbnailId: Schema.NullOr(Id("bucketFiles")),
        width: Schema.NullOr(Pixels),
      }),
      returns: () => UploadView,
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          AttachmentRefused,
          FileSizeRefused,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () => ({ ...classArgs, uploadId: Id("classroomUploads") }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({
        authorId: Id("tenantPeople"),
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        classId: Id("classes"),
        contentType: Schema.String,
        height: Schema.NullOr(Pixels),
        kind: AttachmentKind,
        fileId: Id("bucketFiles"),
        name: AttachmentName,
        thumbnailId: Schema.NullOr(Id("bucketFiles")),
        width: Schema.NullOr(Pixels),
      }),
      returns: () => UploadView,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Struct({ deleted: Schema.Int }),
    })
  );
