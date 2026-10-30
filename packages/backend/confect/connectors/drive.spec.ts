import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ConnectorOff,
  GoogleFailed,
} from "@repo/backend/confect/connectors/errors";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/**
 * The Drive connector of an account (ADR 0015). Google's Picker runs in the
 * browser and takes an access token, so `pickerToken` gives the signed-in account
 * a fresh one from its Drive connection, with the project's browser key and
 * number: the token covers `drive.file` alone, lasts about an hour, and Nakafa
 * stores none. An account without an active Drive connection gets none.
 * `ownTarget` is internal: the token's own read and the library's import of a
 * picked file use it.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "pickerToken",
      args: () => ({}),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            accessToken: Schema.String,
            apiKey: Schema.String,
            appId: Schema.String,
          })
        ),
      error: () => Schema.Union([AuthFailure, ConnectorOff, GoogleFailed]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "ownTarget",
      args: () => ({ userId: Id("users") }),
      returns: () =>
        Schema.NullOr(
          Schema.Struct({
            connectionId: Id("connectorConnections"),
            refreshToken: Schema.String,
          })
        ),
    })
  );
