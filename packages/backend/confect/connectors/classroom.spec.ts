import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ConnectorOff,
  GoogleFailed,
} from "@repo/backend/confect/connectors/errors";
import {
  ClassroomPreview,
  ClassroomWork,
} from "@repo/backend/confect/connectors/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What an import reads before it calls Classroom: the school's connection, its opened token, and its links. */
const ImportTarget = Schema.Struct({
  classes: Schema.Array(
    Schema.Struct({ id: Id("classes"), name: Schema.String })
  ),
  connectionId: Id("connectorConnections"),
  links: Schema.Array(
    Schema.Struct({ classId: Id("classes"), courseId: Schema.String })
  ),
  refreshToken: Schema.String,
});

/**
 * The Classroom import of a school (ADR 0015, journey J7). An Admin previews the
 * courses that the school's Classroom connection teaches, with their number of
 * students and the class each is linked to, beside the school's active classes, and links a course to a class or
 * removes the link. A sync then imports each linked course's published
 * coursework with a deadline into its class's tasks, once each. Students are not
 * matched until the member ID gate of ADR 0015 passes.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "canImport",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Struct({}),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "connection.view" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "preview",
      args: () => ({ slug: TenantSlug }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            classes: Schema.Array(
              Schema.Struct({ id: Id("classes"), name: Schema.String })
            ),
            connectionId: Id("connectorConnections"),
            courses: Schema.Array(ClassroomPreview),
          })
        ),
      error: () =>
        Schema.Union([AuthFailure, AccessDenied, ConnectorOff, GoogleFailed]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "link",
      args: () => ({
        classId: Schema.NullOr(Id("classes")),
        connectionId: Id("connectorConnections"),
        courseId: Schema.NonEmptyString,
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "connection.create" })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "target",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.NullOr(ImportTarget),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "links",
      args: () => ({ connectionId: Id("connectorConnections") }),
      returns: () => Schema.Array(Schema.Struct({ courseId: Schema.String })),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "storeWork",
      args: () => ({
        connectionId: Id("connectorConnections"),
        courseId: Schema.NonEmptyString,
        works: Schema.Array(ClassroomWork),
      }),
      returns: () => Schema.Struct({ changed: Schema.Boolean }),
    })
  );
