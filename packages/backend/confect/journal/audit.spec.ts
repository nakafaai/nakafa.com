import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { ChangeView, SubjectView } from "@repo/backend/confect/journal/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** Who acted, resolved for display. Account identities never reach the school. */
const ActorView = Schema.Union([
  Schema.Struct({
    id: Id("tenantPeople"),
    kind: Schema.Literal("person"),
    name: PersonName,
  }),
  Schema.Struct({ kind: Schema.Literals(["user", "system"]) }),
]);

export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () =>
        Schema.Struct({
          actor: ActorView,
          at: Schema.Finite,
          change: ChangeView,
          id: Id("journalEntries"),
          subject: SubjectView,
          subjectName: Schema.OptionFromNullOr(PersonName),
        }),
    }).middleware(TenantAccess, { action: "audit.view" })
  );
