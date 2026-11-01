import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readsSubject } from "@repo/backend/confect/integrations/subject";
import { type Fixture, seeded } from "@repo/backend/test/hooks";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const goneGrade = Schema.decodeUnknownSync(Id("classGrades"))("1gone");
const goneLink = Schema.decodeUnknownSync(Id("guardianLinks"))("1gone");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("readsSubject", () => {
  /** The client of a seeded webhook and its school, the principal of a delivery. */
  const principal = (
    fixture: Fixture,
    clientId: GenericId.GenericId<"integrationClients">
  ) =>
    fixture.run(
      Effect.gen(function* () {
        const reader = yield* DatabaseReader;
        const client = yield* reader
          .table("integrationClients")
          .get(clientId)
          .pipe(Effect.orDie);
        const tenant = yield* reader
          .table("tenants")
          .get(client.tenantId)
          .pipe(Effect.orDie);
        return { client, tenant };
      })
    );

  it.effect(
    "decides each kind that publishes through that kind's authority",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId } = yield* seeded(fixture);
        const read = yield* principal(fixture, clientId);
        const reads = (
          subject: Parameters<typeof readsSubject>[0]["subject"]
        ) => fixture.run(readsSubject({ subject }, read));

        expect(yield* reads({ id: fixture.units.sma, kind: "unit" })).toBe(
          true
        );
        expect(
          yield* reads({ id: fixture.people.admin.personId, kind: "person" })
        ).toBe(true);
      })
  );

  it.effect(
    "closes a subject that is gone, and a kind that publishes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { clientId } = yield* seeded(fixture);
        const read = yield* principal(fixture, clientId);
        const reads = (
          subject: Parameters<typeof readsSubject>[0]["subject"]
        ) => fixture.run(readsSubject({ subject }, read));

        expect(yield* reads({ id: goneGrade, kind: "grade" })).toBe(false);
        expect(yield* reads({ id: goneLink, kind: "guardianLink" })).toBe(
          false
        );
        expect(yield* reads({ id: clientId, kind: "integration" })).toBe(false);
      })
  );
});
