import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * A connector this deployment does not offer: its name is not in
 * `GOOGLE_CONNECTORS`, or the connectors client has no secret. Production lists
 * no connector until Google's review of its scopes passes (ADR 0015).
 */
export class ConnectorOff extends Schema.TaggedError<ConnectorOff>()(
  "ConnectorOff",
  refusal("CONNECTOR_OFF", "This connector is not available yet.")
) {}

/**
 * A connect that cannot finish: its state is unknown, expired, already used, or
 * started by another account. Nothing is connected.
 */
export class ConnectStateInvalid extends Schema.TaggedError<ConnectStateInvalid>()(
  "ConnectStateInvalid",
  refusal("CONNECT_STATE_INVALID", "This connect has expired. Start it again.")
) {}

/**
 * Google refused or did not answer a request of a connector: `refused` for an
 * answer outside 2xx, `revoked` when Google no longer accepts the connection's
 * token, `unreached` when no answer came within the deadline, and `invalid` for
 * an answer that does not decode. No token is in it.
 */
export class GoogleFailed extends Schema.TaggedError<GoogleFailed>()(
  "GoogleFailed",
  {
    reason: Schema.Literals(["refused", "revoked", "unreached", "invalid"]),
    status: Schema.optionalKey(Schema.Int),
  }
) {}

/**
 * A consent that granted fewer scopes than the connector asks for, because the
 * user left one unchecked on Google's screen. Nothing is connected.
 */
export class ScopesMissing extends Schema.TaggedError<ScopesMissing>()(
  "ScopesMissing",
  refusal(
    "SCOPES_MISSING",
    "Google did not grant every access this connector needs."
  )
) {}
