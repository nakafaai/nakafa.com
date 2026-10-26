import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  SCHOOL_API_PATH,
  SchoolApi,
} from "@repo/backend/confect/integrations/api";
import { createClient, type Fixture, issue } from "@repo/backend/test/api";
import { cohort, period } from "@repo/backend/test/classroom";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodePrettyJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";
import { OpenApi } from "effect/http-api";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** One page of a read, with its rows left undecoded. */
const Page = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  next: Schema.NullOr(Schema.String),
});

/** The access token of an issued token answer. */
const IssuedToken = Schema.Struct({ access_token: Schema.String });

/** One JSON body of a response, as text the test decodes. */
const json = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown)))
  );

/** Asks the token endpoint for a token with a form body, as an integration does. */
const postToken = (fixture: Fixture, form: Record<string, string>) =>
  Effect.promise(() =>
    fixture.fetch(`${SCHOOL_API_PATH}/token`, {
      body: new URLSearchParams(form).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
  );

/** Reads one school API path with a bearer token, or none. */
const read = (fixture: Fixture, path: string, token?: string) =>
  Effect.promise(() =>
    fixture.fetch(`${SCHOOL_API_PATH}${path}`, {
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    })
  );

describe("school API over HTTP", () => {
  it.effect(
    "issues a token with the client credentials grant and serves the roster to its bearer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const client = yield* createClient(fixture);
        const answer = yield* postToken(fixture, {
          client_id: client.id,
          client_secret: client.secret,
          grant_type: "client_credentials",
        });
        expect(answer.status).toBe(200);
        const issued = yield* json(answer).pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(
              Schema.Struct({
                access_token: Schema.String,
                expires_in: Schema.Finite,
                token_type: Schema.Literal("Bearer"),
              })
            )
          )
        );
        const periods = yield* read(fixture, "/periods", issued.access_token);
        expect(periods.status).toBe(200);
        expect(yield* json(periods)).toMatchObject({
          data: [{ id: term.id }],
          next: null,
        });
        yield* cohort(fixture, term.id, "7A");
        yield* cohort(fixture, term.id, "7B");
        const first = yield* read(
          fixture,
          `/cohorts?period=${term.id}&limit=1`,
          issued.access_token
        ).pipe(
          Effect.flatMap(json),
          Effect.flatMap(Schema.decodeUnknownEffect(Page))
        );
        expect(first.data).toHaveLength(1);
        expect(first.next).not.toBeNull();
        const second = yield* read(
          fixture,
          `/cohorts?period=${term.id}&limit=1&cursor=${encodeURIComponent(first.next ?? "")}`,
          issued.access_token
        ).pipe(
          Effect.flatMap(json),
          Effect.flatMap(Schema.decodeUnknownEffect(Page))
        );
        expect(second.data).toHaveLength(1);
        expect(second.data).not.toEqual(first.data);
        for (const path of [
          "/people",
          "/people?status=suspended",
          `/placements?period=${term.id}`,
        ]) {
          expect((yield* read(fixture, path, issued.access_token)).status).toBe(
            200
          );
        }
      })
  );

  it.effect(
    "answers a client past its request limit 429 with the seconds to wait",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const issued = yield* issue(fixture, client);
        const token = issued.outcome === "issued" ? issued.token : "";
        for (const _ of Arr.makeBy(600, (index) => index)) {
          yield* fixture.internal.mutation(
            refs.internal.integrations.tokens.check,
            {
              resource: "api",
              token,
            }
          );
        }
        const limited = yield* read(fixture, "/periods", token);
        expect(limited.status).toBe(429);
        expect(yield* json(limited)).toMatchObject({
          _tag: "SchoolApiRateLimited",
        });
      })
  );

  it.effect(
    "answers a missing token 401, a closed read 403, a wrong grant 400, and a wrong secret 401",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture, ["period.view"]);
        expect((yield* read(fixture, "/periods")).status).toBe(401);
        expect((yield* read(fixture, "/periods", "nope")).status).toBe(401);
        const grant = yield* postToken(fixture, {
          client_id: client.id,
          client_secret: client.secret,
          grant_type: "password",
        });
        expect(grant.status).toBe(400);
        expect(yield* json(grant)).toMatchObject({
          error: "unsupported_grant_type",
        });
        const wrong = yield* postToken(fixture, {
          client_id: client.id,
          client_secret: "wrong",
          grant_type: "client_credentials",
        });
        expect(wrong.status).toBe(401);
        expect(yield* json(wrong)).toMatchObject({ error: "invalid_client" });
        const target = yield* postToken(fixture, {
          client_id: client.id,
          client_secret: client.secret,
          grant_type: "client_credentials",
          resource: "https://other.nakafa.com/api/v1",
        });
        expect(target.status).toBe(400);
        const issued = yield* postToken(fixture, {
          client_id: client.id,
          client_secret: client.secret,
          grant_type: "client_credentials",
        }).pipe(Effect.flatMap(json));
        const { access_token: token } =
          yield* Schema.decodeUnknownEffect(IssuedToken)(issued);
        expect((yield* read(fixture, "/people", token)).status).toBe(403);
      })
  );

  it.effect(
    "serves the OpenAPI document without a token, the same as the committed contract",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const served = yield* read(fixture, "/openapi.json");
        expect(served.status).toBe(200);
        const document = OpenApi.fromApi(SchoolApi);
        expect(yield* json(served)).toEqual(document);
        yield* Effect.promise(() =>
          expect(`${encodePrettyJsonText(document)}\n`).toMatchFileSnapshot(
            "./openapi.json"
          )
        );
      })
  );
});
