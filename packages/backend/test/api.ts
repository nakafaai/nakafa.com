import refs from "@repo/backend/confect/_generated/refs";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { SCHOOL_API_PATH } from "@repo/backend/confect/integrations/api";
import type { ClientActions } from "@repo/backend/confect/integrations/schema";
import { nf } from "@repo/backend/test/classroom";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

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

/** The access token of an issued token answer. */
export const IssuedToken = Schema.Struct({ access_token: Schema.String });

/** One JSON body of a response, as text the test decodes. */
export const json = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown)))
  );

/** Asks the token endpoint for a token with a form body, as an integration does. */
export const postToken = (fixture: Fixture, form: Record<string, string>) =>
  Effect.promise(() =>
    fixture.fetch(`${SCHOOL_API_PATH}/token`, {
      body: new URLSearchParams(form).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
  );

/** Reads one school API path with a bearer token, or none. */
export const read = (fixture: Fixture, path: string, token?: string) =>
  Effect.promise(() =>
    fixture.fetch(`${SCHOOL_API_PATH}${path}`, {
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    })
  );

/** A token of a client that holds `actions`, as the token endpoint answers it. */
export const tokenOf = Effect.fn("test.api.tokenOf")(function* (
  fixture: Fixture,
  actions: Parameters<typeof createClient>[1]
) {
  const client = yield* createClient(fixture, actions);
  const answer = yield* postToken(fixture, {
    client_id: client.id,
    client_secret: client.secret,
    grant_type: "client_credentials",
  });
  const issued = yield* json(answer).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(IssuedToken))
  );
  return issued.access_token;
});
