import refs from "@repo/backend/confect/_generated/refs";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import type { ClientActions } from "@repo/backend/confect/integrations/schema";
import { nf } from "@repo/backend/test/classroom";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import type { Effect } from "effect";

/** The fixture `tenancyFixture` seeds, which the school API tests extend. */
export type Fixture = Effect.Success<typeof tenancyFixture>;

/** The roster reads a school API client holds by default. */
const ROSTER_READS: typeof ClientActions.Type = [
  "cohort.view",
  "period.view",
  "person.view",
];

/** The school's Admin creates a client and gets its secret once. */
export const createClient = (
  fixture: Fixture,
  actions: typeof ClientActions.Type = ROSTER_READS,
  scope: GrantScope = { kind: "tenant" }
) =>
  fixture.as("admin").mutation(refs.public.integrations.clients.create, {
    actions,
    name: "Sinkron SIS",
    scope,
    slug: nf,
  });

/** Asks the token endpoint's internal issue for a token, as the route does. */
export const issue = (
  fixture: Fixture,
  client: { readonly id: string; readonly secret: string },
  resource?: string
) =>
  fixture.internal.mutation(refs.internal.integrations.tokens.issue, {
    clientId: client.id,
    secret: client.secret,
    ...(resource === undefined ? {} : { resource }),
  });
