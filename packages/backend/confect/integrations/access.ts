import { MiddlewareSpec } from "@confect/core";
import type { IntegrationClientsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The integration client that the function's `IntegrationAccess` check loaded and allowed. */
export class Integration extends Context.Service<
  Integration,
  IntegrationClientsDoc
>()("@repo/backend/confect/integrations/access/Integration") {}

/** Checks an integration action on the client whose ID the `arg` argument holds. */
export class IntegrationAccess extends MiddlewareSpec.MiddlewareSpec<
  IntegrationAccess,
  { provides: Integration; requires: Member }
>()("IntegrationAccess", Kind.middleware(entries, "integration")) {}
