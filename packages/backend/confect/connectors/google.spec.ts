import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ConnectorOff,
  ConnectStateInvalid,
} from "@repo/backend/confect/connectors/errors";
import { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import {
  ConnectOutcome,
  ReturnPath,
} from "@repo/backend/confect/connectors/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Space } from "@repo/backend/confect/space";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What a started connect answers: the address of Google's consent screen. */
const Started = Schema.Struct({ url: Schema.String });

/** The connect that a callback's state names, which `claim` takes once, with the address it returns to. */
const Claimed = Schema.Struct({
  connector: GoogleConnector,
  location: Schema.String,
  owner: Space,
  personId: Schema.NullOr(Id("tenantPeople")),
  redirectUri: Schema.String,
  verifier: Schema.String,
});

/**
 * The connect flow of the Google connectors (ADR 0015). An account starts a
 * personal connection of Drive or Calendar, and a school's teacher or Admin starts
 * a school connection of Classroom: each answers the address of Google's consent
 * screen, with PKCE and a state that the callback brings back. `finish` takes the
 * callback's code and state, exchanges the code with Google, stores the
 * connection with its refresh token sealed under its owner's key, and answers
 * how the connect ended and the same-site address to return to. `offered` names
 * the connectors this deployment offers, which production keeps empty until
 * Google's review. `claim` and `store` are internal: only `finish` calls them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "offered",
      args: () => ({}),
      returns: () => Schema.Array(GoogleConnector),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startPersonal",
      args: () => ({
        connector: GoogleConnector,
        redirectUri: Schema.String,
        returnPath: ReturnPath,
      }),
      returns: () => Started,
      error: () => Schema.Union([AuthFailure, ConnectorOff]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startSchool",
      args: () => ({
        connector: GoogleConnector,
        redirectUri: Schema.String,
        returnPath: ReturnPath,
        slug: TenantSlug,
      }),
      returns: () => Started,
      error: () => Schema.Union([AccessDenied, ConnectorOff]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "connection.create" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "finish",
      args: () => ({
        code: Schema.NullOr(Schema.String),
        state: Schema.String,
      }),
      returns: () => ConnectOutcome,
      error: () => Schema.Union([AuthFailure, ConnectStateInvalid]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({ state: Schema.String, userId: Id("users") }),
      returns: () => Schema.NullOr(Claimed),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "store",
      args: () => ({
        connector: GoogleConnector,
        owner: Space,
        personId: Schema.NullOr(Id("tenantPeople")),
        refreshToken: Schema.NonEmptyString,
        scopes: Schema.Array(Schema.NonEmptyString),
        subject: Schema.NonEmptyString,
        userId: Id("users"),
      }),
      returns: () => Id("connectorConnections"),
    })
  );
