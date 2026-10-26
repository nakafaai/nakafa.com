import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TOKEN_SECONDS } from "@repo/backend/confect/integrations/api";
import { createClient, issue } from "@repo/backend/test/api";
import { nf } from "@repo/backend/test/classroom";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

const { check, sweep } = refs.internal.integrations.tokens;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The stored access tokens, oldest first. */
const tokenRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("integrationTokens").index("by_creation_time").take(20)
);

describe("integrations/tokens issue", () => {
  it.effect(
    "issues a token for the client's own secret, keeps only its digest, and binds it to the API",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const issued = yield* issue(fixture, client);
        expect(issued).toMatchObject({
          expiresIn: TOKEN_SECONDS,
          outcome: "issued",
        });
        const [row] = yield* fixture.run(tokenRows);
        expect(row).toMatchObject({
          clientId: client.id,
          expiresAt:
            TENANCY_NOW + Duration.toMillis(Duration.seconds(TOKEN_SECONDS)),
          resource: "api",
        });
        expect(row?.tokenHash).not.toBe(
          issued.outcome === "issued" ? issued.token : ""
        );
        expect(
          yield* issue(fixture, client, "https://nf.nakafa.com/mcp")
        ).toMatchObject({ outcome: "issued" });
        expect(
          Arr.map(yield* fixture.run(tokenRows), (token) => token.resource)
        ).toEqual(["api", "mcp"]);
      })
  );

  it.effect(
    "refuses a wrong secret, an unknown or malformed client, and a revoked one with one answer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const refused = { error: "invalid_client", outcome: "refused" };
        expect(yield* issue(fixture, { ...client, secret: "wrong" })).toEqual(
          refused
        );
        expect(
          yield* issue(fixture, { id: "not-an-id", secret: client.secret })
        ).toEqual(refused);
        yield* fixture
          .as("admin")
          .mutation(refs.public.integrations.clients.revoke, {
            clientId: client.id,
            slug: nf,
          });
        expect(yield* issue(fixture, client)).toEqual(refused);
      })
  );

  it.effect(
    "refuses a resource that is not the API or MCP of the client's school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        for (const resource of [
          "https://other.nakafa.com/api/v1",
          "https://nf.nakafa.com/settings",
          "http://nf.nakafa.com/api/v1",
          "not a url",
        ]) {
          expect(yield* issue(fixture, client, resource)).toEqual({
            error: "invalid_target",
            outcome: "refused",
          });
        }
        expect(
          yield* issue(fixture, client, "https://nf.nakafa.com/api/v1/")
        ).toMatchObject({ outcome: "issued" });
      })
  );

  it.effect("stops a client that asks for too many tokens", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const client = yield* createClient(fixture);
      for (const _ of Arr.makeBy(20, (index) => index)) {
        yield* issue(fixture, client);
      }
      expect(yield* issue(fixture, client)).toEqual({
        error: "invalid_client",
        outcome: "refused",
      });
    })
  );
});

describe("integrations/tokens check", () => {
  it.effect(
    "allows a live token for its own resource and refuses every other token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const issued = yield* issue(fixture, client);
        const token = issued.outcome === "issued" ? issued.token : "";
        expect(
          yield* fixture.internal.mutation(check, { resource: "api", token })
        ).toEqual({ clientId: client.id, outcome: "allowed" });
        const unauthorized = { outcome: "unauthorized" };
        expect(
          yield* fixture.internal.mutation(check, { resource: "mcp", token })
        ).toEqual(unauthorized);
        expect(
          yield* fixture.internal.mutation(check, {
            resource: "api",
            token: "nope",
          })
        ).toEqual(unauthorized);
        vi.setSystemTime(
          TENANCY_NOW + Duration.toMillis(Duration.seconds(TOKEN_SECONDS))
        );
        expect(
          yield* fixture.internal.mutation(check, { resource: "api", token })
        ).toEqual(unauthorized);
      })
  );

  it.effect("ends every token of a client that is revoked or rotated", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const client = yield* createClient(fixture);
      yield* issue(fixture, client);
      const rotated = yield* fixture
        .as("admin")
        .mutation(refs.public.integrations.clients.rotate, {
          clientId: client.id,
          slug: nf,
        });
      expect(yield* fixture.run(tokenRows)).toEqual([]);
      const issued = yield* issue(fixture, rotated);
      const token = issued.outcome === "issued" ? issued.token : "";
      yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("integrationClients").get(client.id)
        ).pipe(Effect.asVoid)
      );
      yield* fixture
        .as("admin")
        .mutation(refs.public.integrations.clients.revoke, {
          clientId: client.id,
          slug: nf,
        });
      expect(yield* fixture.run(tokenRows)).toEqual([]);
      expect(
        yield* fixture.internal.mutation(check, { resource: "api", token })
      ).toEqual({ outcome: "unauthorized" });
    })
  );

  it.effect("tells a client past its request limit when to retry", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const client = yield* createClient(fixture);
      const issued = yield* issue(fixture, client);
      const token = issued.outcome === "issued" ? issued.token : "";
      for (const _ of Arr.makeBy(600, (index) => index)) {
        yield* fixture.internal.mutation(check, { resource: "api", token });
      }
      expect(
        yield* fixture.internal.mutation(check, { resource: "api", token })
      ).toMatchObject({ outcome: "limited", retryAfter: expect.any(Number) });
    })
  );

  it.effect("sweeps expired tokens and keeps live ones", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const client = yield* createClient(fixture);
      yield* issue(fixture, client);
      vi.setSystemTime(
        TENANCY_NOW + Duration.toMillis(Duration.seconds(TOKEN_SECONDS))
      );
      yield* issue(fixture, client);
      expect(yield* fixture.internal.mutation(sweep, {})).toBeNull();
      expect(yield* fixture.run(tokenRows)).toHaveLength(1);
    })
  );
});
