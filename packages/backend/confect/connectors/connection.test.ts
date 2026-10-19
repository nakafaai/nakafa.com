import { describe, expect, it } from "@effect/vitest";
import { connect } from "@repo/backend/confect/connectors/connection";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

/** One Drive connection with no Google account behind it. */
const drive = {
  connector: "drive" as const,
  googleSubject: null,
  refreshToken: "refresh-token-for-the-journal",
  scopes: ["drive.file"],
};

describe("connectors/connection connect", () => {
  it.effect(
    "journals one connection.connected entry for a school connection, with the Person who made it as its actor",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const person = fixture.people.admin.personId;
        yield* fixture.run(createTenantKey(nf));
        const before = yield* fixture.run(journal);
        const connectionId = yield* fixture.run(
          connect(
            { id: person, kind: "person" },
            { kind: "tenant", tenantId: nf },
            drive
          )
        );
        const after = yield* fixture.run(journal);
        expect(Arr.drop(after, before.length)).toMatchObject([
          {
            actor: { id: person, kind: "person" },
            change: {
              connection: connectionId,
              connector: "drive",
              type: "connection.connected",
            },
            owner: { kind: "tenant", tenantId: nf },
            subject: { id: connectionId, kind: "connection" },
          },
        ]);
      })
  );

  it.effect(
    "journals one connection.connected entry for a personal connection, with the account as its actor and its owner",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.users.teacher.userId;
        const before = yield* fixture.run(journal);
        const connectionId = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            drive
          )
        );
        const after = yield* fixture.run(journal);
        expect(Arr.drop(after, before.length)).toMatchObject([
          {
            actor: { id: teacher, kind: "user" },
            change: {
              connection: connectionId,
              connector: "drive",
              type: "connection.connected",
            },
            owner: { kind: "personal", userId: teacher },
            subject: { id: connectionId, kind: "connection" },
          },
        ]);
      })
  );
});
