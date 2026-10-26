import { MiddlewareSpec } from "@confect/core";
import type { GuardianLinksDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The guardian link that the function's `GuardianLinkAccess` check loaded and allowed. */
export class GuardianLink extends Context.Service<
  GuardianLink,
  GuardianLinksDoc
>()("@repo/backend/confect/guardians/access/GuardianLink") {}

/** Checks a guardian link action on the link whose ID the `arg` argument holds. */
export class GuardianLinkAccess extends MiddlewareSpec.MiddlewareSpec<
  GuardianLinkAccess,
  { provides: GuardianLink; requires: Member }
>()("GuardianLinkAccess", Kind.middleware(entries, "guardianLink")) {}
