import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  AssetAddress,
  AssetSizeRefused,
  AssetTypeRefused,
  MAX_ASSET_READS,
} from "@repo/backend/confect/exams/asset";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ImageType } from "@repo/editor/image";
import { Schema } from "effect";

/**
 * The images of an exam. A teacher who may edit the exam gets the address to upload a file
 * to, then registers the stored file: the server reads its size and leading bytes, accepts only
 * the images the editor draws, and stores the image as the exam's. A reader who may view the
 * exam reads the addresses of a prompt's images in one call. `commit`, `discard`, and `stored`
 * are internal: only the registration calls them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "uploadUrl",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => Schema.URLFromString,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "canAdd",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => Schema.Struct({}),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "register",
      args: () => ({
        examId: Id("exams"),
        height: Schema.Int.check(Schema.isGreaterThan(0)),
        slug: TenantSlug,
        storageId: Id("_storage"),
        width: Schema.Int.check(Schema.isGreaterThan(0)),
      }),
      returns: () => Schema.Struct({ id: Id("examAssets") }),
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          AssetSizeRefused,
          AssetTypeRefused,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "urls",
      args: () => ({
        assets: Schema.Array(Id("examAssets")).check(
          Schema.isMaxLength(MAX_ASSET_READS)
        ),
        examId: Id("exams"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Array(AssetAddress),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.view", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "commit",
      args: () => ({
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        contentType: ImageType,
        examId: Id("exams"),
        height: Schema.Int.check(Schema.isGreaterThan(0)),
        storageId: Id("_storage"),
        userId: Id("users"),
        width: Schema.Int.check(Schema.isGreaterThan(0)),
      }),
      returns: () => Schema.Struct({ id: Id("examAssets") }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "discard",
      args: () => ({ storageId: Id("_storage") }),
      returns: () => Schema.Struct({}),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "stored",
      args: () => ({ storageId: Id("_storage") }),
      returns: () => Schema.Struct({ size: Schema.Int }),
    })
  );
