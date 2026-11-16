import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AgentExchange,
  AgentListing,
  AgentRefused,
} from "@repo/backend/confect/auth/grant/schema";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/**
 * Nakafa's OAuth server for the agents a person lets in (ADR 0029): dynamic
 * registration, the authorization code with PKCE, and refresh tokens. The web
 * app's agent routes speak the OAuth protocol and call these; the consent page
 * and the settings page call the signed-in ones.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "register",
      args: () => ({
        name: Schema.String,
        redirectUris: Schema.Array(Schema.String),
      }),
      returns: () => Schema.Struct({ clientId: Id("agentClients") }),
      error: () => AgentRefused,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "describe",
      args: () => ({ clientId: Schema.String }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            name: Schema.String,
            redirect: Schema.NullOr(Schema.String),
          })
        ),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "authorize",
      args: () => ({
        clientId: Schema.String,
        codeChallenge: Schema.String,
        redirectUri: Schema.String,
      }),
      returns: () => Schema.Struct({ code: Schema.String }),
      error: () => Schema.Union([AuthFailure, AgentRefused]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "exchange",
      args: () => ({
        clientId: Schema.String,
        code: Schema.String,
        codeVerifier: Schema.String,
        redirectUri: Schema.String,
      }),
      returns: () => AgentExchange,
      error: () => AgentRefused,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "refresh",
      args: () => ({ clientId: Schema.String, refreshToken: Schema.String }),
      returns: () => AgentExchange,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      returns: () => Schema.Array(AgentListing),
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => ({ grantId: Id("agentGrants") }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      returns: () => Schema.Null,
    })
  );
