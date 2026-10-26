import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { ConnectorKind } from "@repo/backend/confect/connectors/schema";
import { tenant } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One connection of a school or an account. A school connection is decided on its
 * row for its Owner and Admin (`connectors/authority`). Ending a connection is a
 * transition, so a suspended school and a locked row still let its Owner or Admin
 * disconnect it, as ADR 0012 allows. Its audited changes hold IDs and enums only,
 * so a token and a Google account never reach the journal. A personal connection
 * is not a row of any school, so no tenant decides it: its owner checks the signed-in
 * account instead (`connectors/connection`).
 */
export const connection = Kind.make("connection", "connectorConnections", {
  actions: {
    "connection.manage": {
      access: "transition",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "connection.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema.Literal("connection.connected"),
    }),
    Schema.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema.Literal("connection.disconnected"),
    }),
    Schema.Struct({
      connection: Id("connectorConnections"),
      connector: ConnectorKind,
      type: Schema.Literal("connection.reconnect"),
    }),
  ],
  published: [],
  relations: [],
});

/**
 * A school's connections are listed on its tenant, for its Owner and Admin. A
 * teacher or an Admin connects the school to a source, as a teacher who moves
 * classes from Google Classroom does (ADR 0015, journey J7).
 */
const tenantConnections = Kind.extend(tenant, {
  actions: {
    "connection.create": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "teacher"],
    },
    "connection.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

/**
 * The connectors module's kinds for the access catalog: the connection, and its
 * extension of the tenant.
 */
export const connectors = {
  extensions: [tenantConnections],
  kinds: [connection],
};
