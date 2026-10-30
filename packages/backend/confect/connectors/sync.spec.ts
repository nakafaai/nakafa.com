import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  CalendarEvent,
  ConnectorKind,
} from "@repo/backend/confect/connectors/schema";
import { Space } from "@repo/backend/confect/space";
import { Schema } from "effect";

/** What a sync of one connection reads before it calls its source: the connector, the owner, and the opened refresh token. */
const SyncTarget = Schema.Struct({
  connector: ConnectorKind,
  owner: Space,
  refreshToken: Schema.String,
});

/**
 * The sync of the connections that keep a copy of their source (ADR 0015). A
 * sweep every few minutes takes the active connections whose sync is due, at
 * most `SCHOOL_CAP` of each owner, leases each, and schedules its run. A run
 * refreshes the access token, reads the source, and stores the copy, which sets
 * the next sync sooner when the source changed and later when it did not. A
 * source that stops accepting the token moves the connection to `reconnect`.
 * Every function is internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Struct({ scheduled: Schema.Int }),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "target",
      args: () => ({ connectionId: Id("connectorConnections") }),
      returns: () => Schema.NullOr(SyncTarget),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => ({ connectionId: Id("connectorConnections") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "storeEvents",
      args: () => ({
        connectionId: Id("connectorConnections"),
        events: Schema.Array(CalendarEvent),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "settle",
      args: () => ({
        changed: Schema.Boolean,
        connectionId: Id("connectorConnections"),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reconnect",
      args: () => ({ connectionId: Id("connectorConnections") }),
      returns: () => Schema.Null,
    })
  );
