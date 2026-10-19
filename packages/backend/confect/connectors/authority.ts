import type { GenericId } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority } from "@repo/backend/confect/access/policy";
import {
  ConnectionAccess,
  SchoolConnection,
  type SchoolConnectionDoc,
} from "@repo/backend/confect/connectors/access";
import { connection } from "@repo/backend/confect/connectors/kinds";
import { Effect, Option } from "effect";

/** Whether a connection row belongs to a school, so the school's authority decides it. */
const isSchoolConnection = (
  row: Docs["connectorConnections"]
): row is SchoolConnectionDoc => row.owner.kind === "tenant";

/**
 * Loads a school connection by ID. A personal connection belongs to no school, so
 * it is not found here, and an action on it is refused as a missing subject.
 */
const loadSchoolConnection = (
  id: GenericId.GenericId<"connectorConnections">
) =>
  Effect.map(Authority.load(connection)(id), Option.filter(isSchoolConnection));

/**
 * A school connection is locked once it is disconnected. It belongs to its
 * school's tenant, and no unit covers it, because a connection is a school's own.
 */
const connectionAuthority = Authority.make(connection, loadSchoolConnection, {
  place: (row) =>
    Effect.succeed({
      locked: row.status === "disconnected",
      units: [],
    }),
  relations: {},
  tenantOf: (row) => row.owner.tenantId,
});

/**
 * Implements the `ConnectionAccess` check: it authorizes the action on the school
 * connection whose ID the named argument holds, and provides that connection.
 */
export const connectionAccess = MiddlewareImpl.make(
  databaseSchema,
  ConnectionAccess,
  connectionAuthority.middleware(SchoolConnection)
);
