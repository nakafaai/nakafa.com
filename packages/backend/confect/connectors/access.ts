import { MiddlewareSpec } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { SchoolOwnership } from "@repo/backend/confect/connectors/schema";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** A connection that a school owns: its owner is the school's tenant, never an account. */
export type SchoolConnectionDoc = Docs["connectorConnections"] &
  typeof SchoolOwnership.Type;

/** The school connection that the function's `ConnectionAccess` check loaded and allowed. */
export class SchoolConnection extends Context.Service<
  SchoolConnection,
  SchoolConnectionDoc
>()("@repo/backend/confect/connectors/access/SchoolConnection") {}

/** Checks a connection action on the school connection whose ID the `arg` argument holds. */
export class ConnectionAccess extends MiddlewareSpec.MiddlewareSpec<
  ConnectionAccess,
  { provides: SchoolConnection; requires: Member }
>()("ConnectionAccess", Kind.middleware(entries, "connection")) {}
