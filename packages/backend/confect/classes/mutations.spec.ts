import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import {
  schoolClassImageValidator,
  schoolClassVisibilityValidator,
} from "@repo/backend/confect/classes/schema";
import { classJoinMutationResultValidator } from "@repo/backend/confect/classes/validators";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { InvitationError } from "@repo/backend/confect/schools/invitations/spec";
import { PermissionDenied } from "@repo/backend/confect/schools/permission/spec";
import { Schema } from "effect";
export class ClassMutationError extends Schema.TaggedError<ClassMutationError>()(
  "ClassMutationError",
  {
    code: Schema.Literals([
      "INVALID_CODE",
      "NOT_SCHOOL_MEMBER",
      "CLASS_NOT_PUBLIC",
      "INVALID_IMAGE",
    ]),
    message: Schema.String,
  }
) {}
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createClass",
      args: () => ({
        schoolId: IdSchema("schools"),
        name: Schema.String,
        subject: Schema.String,
        year: Schema.String,
        visibility: schoolClassVisibilityValidator,
      }),
      returns: () => IdSchema("schoolClasses"),
      error: () => Schema.Union([AuthFailure, PermissionDenied]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinClass",
      args: () => ({
        code: Schema.String,
      }),
      returns: () => classJoinMutationResultValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          ClassMutationError,
          ClassAccessError,
          InvitationError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateClassVisibility",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        visibility: schoolClassVisibilityValidator,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([AuthFailure, PermissionDenied, ClassAccessError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinPublicClass",
      args: () => ({
        classId: IdSchema("schoolClasses"),
      }),
      returns: () => classJoinMutationResultValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          ClassAccessError,
          ClassMutationError,
          InvitationError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateClassImage",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        image: schoolClassImageValidator,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AuthFailure,
          PermissionDenied,
          ClassAccessError,
          ClassMutationError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
