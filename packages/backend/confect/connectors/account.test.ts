import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  blindGoogleAccount,
  countActiveGrants,
} from "@repo/backend/confect/connectors/account";
import {
  connect,
  disconnect,
} from "@repo/backend/confect/connectors/connection";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const BLIND_SHAPE = /^[\w-]{22}$/u;
const SUBJECT = "google-subject-of-the-teacher";
const OTHER_SUBJECT = "google-subject-of-another-teacher";

/** One Drive connection of a Google account, whose subject the caller gives. */
const driveOf = (googleSubject: string) => ({
  connector: "drive" as const,
  googleSubject,
  refreshToken: `refresh-token-of-${googleSubject}`,
  scopes: ["drive.file"],
});

/** One stored connection, read inside the fixture. */
const stored = (connectionId: GenericId.GenericId<"connectorConnections">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("connectorConnections").get(connectionId).pipe(Effect.orDie)
  );

describe("connectors/account", () => {
  it.effect(
    "blinds one Google account to one value under a learner and under a school, and stores no subject",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const teacher = fixture.users.teacher.userId;
        const person = fixture.people.admin.personId;
        yield* fixture.run(createTenantKey(nf));
        const learnerConnection = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            driveOf(SUBJECT)
          )
        );
        const schoolConnection = yield* fixture.run(
          connect(
            { id: person, kind: "person" },
            { kind: "tenant", tenantId: nf },
            driveOf(SUBJECT)
          )
        );
        const otherConnection = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            driveOf(OTHER_SUBJECT)
          )
        );
        const learnerBlind = (yield* fixture.run(stored(learnerConnection)))
          .googleAccountKey;
        const schoolBlind = (yield* fixture.run(stored(schoolConnection)))
          .googleAccountKey;
        const otherBlind = (yield* fixture.run(stored(otherConnection)))
          .googleAccountKey;
        expect(learnerBlind).toMatch(BLIND_SHAPE);
        expect(learnerBlind).not.toContain(SUBJECT);
        expect(schoolBlind).toBe(learnerBlind);
        expect(otherBlind).not.toBe(learnerBlind);
        expect(yield* fixture.run(blindGoogleAccount(SUBJECT))).toBe(
          learnerBlind
        );
      })
  );

  it.effect(
    "counts the active connections of one Google account across a learner and a school, and ends the count as each one is disconnected",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const teacher = fixture.users.teacher.userId;
        const person = fixture.people.admin.personId;
        yield* fixture.run(createTenantKey(nf));
        const learnerConnection = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            driveOf(SUBJECT)
          )
        );
        const schoolConnection = yield* fixture.run(
          connect(
            { id: person, kind: "person" },
            { kind: "tenant", tenantId: nf },
            driveOf(SUBJECT)
          )
        );
        const otherConnection = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            driveOf(OTHER_SUBJECT)
          )
        );
        const blind = yield* fixture.run(blindGoogleAccount(SUBJECT));
        const otherBlind = yield* fixture.run(
          blindGoogleAccount(OTHER_SUBJECT)
        );
        expect(yield* fixture.run(countActiveGrants(blind))).toBe(2);
        expect(yield* fixture.run(countActiveGrants(otherBlind))).toBe(1);

        yield* fixture.run(
          disconnect(
            { id: person, kind: "person" },
            yield* fixture.run(stored(schoolConnection))
          )
        );
        expect(yield* fixture.run(countActiveGrants(blind))).toBe(1);

        yield* fixture.run(
          disconnect(
            { id: teacher, kind: "user" },
            yield* fixture.run(stored(learnerConnection))
          )
        );
        expect(yield* fixture.run(countActiveGrants(blind))).toBe(0);

        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("connectorConnections")
              .patch(otherConnection, { status: "reconnect" })
          )
        );
        expect(yield* fixture.run(countActiveGrants(otherBlind))).toBe(0);
      })
  );
});
