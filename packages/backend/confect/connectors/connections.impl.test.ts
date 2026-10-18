import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { connect } from "@repo/backend/confect/connectors/connection";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const nf = slugOf("nf");
const { disconnectOwn, disconnectSchool, listOwn, listSchool } =
  refs.public.connectors.connections;
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };

/** One Drive connection that holds the refresh token given. */
const drive = (refreshToken: string) => ({
  connector: "drive" as const,
  googleSubject: null,
  refreshToken,
  scopes: ["drive.file"],
});

/** One stored connection, read inside the fixture. */
const stored = (connectionId: GenericId.GenericId<"connectorConnections">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("connectorConnections").get(connectionId).pipe(Effect.orDie)
  );

/** Whether a connection still holds a sealed token. */
const holdsSecret = (
  connectionId: GenericId.GenericId<"connectorConnections">
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("connectorSecrets")
      .index("by_connectionId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .first()
      .pipe(Effect.map(Option.isSome), Effect.orDie)
  );

describe("connectors/connections list", () => {
  it.effect(
    "lets an Admin list the school's connections, and no token or Google account key",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        yield* fixture.run(createTenantKey(fixture.tenants.other));
        const made = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            { ...drive("school-token"), googleSubject: "google-subject-school" }
          )
        );
        yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.other },
            drive("other-token")
          )
        );
        const listed = yield* fixture
          .as("admin")
          .query(listSchool, { ...firstPage, slug: nf });
        expect(listed.page).toEqual([
          {
            connector: "drive",
            createdAt: expect.any(Number),
            id: made,
            lastSyncedAt: null,
            nextSyncAt: null,
            scopes: ["drive.file"],
            status: "active",
          },
        ]);
      })
  );

  it.effect(
    "shows a connection whose source refused its token in the reconnect state",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const made = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            drive("school-token")
          )
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("connectorConnections")
              .patch(made, { status: "reconnect" })
          )
        );
        const listed = yield* fixture
          .as("admin")
          .query(listSchool, { ...firstPage, slug: nf });
        expect(Arr.map(listed.page, (row) => row.status)).toEqual([
          "reconnect",
        ]);
      })
  );

  it.effect(
    "refuses the school list to a teacher, and to another school's Owner",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = yield* fixture
          .as("teacher")
          .query(listSchool, { ...firstPage, slug: nf })
          .pipe(Effect.flip);
        const stranger = yield* fixture
          .as("otherOwner")
          .query(listSchool, { ...firstPage, slug: nf })
          .pipe(Effect.flip);
        expect([teacher, stranger]).toMatchObject([denied("role"), notMember]);
      })
  );

  it.effect(
    "lists a teacher's own personal connections only, and none of another account's",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.users.teacher.userId;
        const student = fixture.users.student.userId;
        const own = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            drive("teacher-token")
          )
        );
        yield* fixture.run(
          connect(
            { id: student, kind: "user" },
            { kind: "personal", userId: student },
            drive("student-token")
          )
        );
        const listed = yield* fixture.as("teacher").query(listOwn, firstPage);
        const unrelated = yield* fixture
          .as("stranger")
          .query(listOwn, firstPage);
        expect(Arr.map(listed.page, (row) => row.id)).toEqual([own]);
        expect(unrelated.page).toEqual([]);
      })
  );
});

describe("connectors/connections disconnect", () => {
  it.effect(
    "disconnects a school connection once: destroys its token and journals one change",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const connectionId = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            drive("school-token")
          )
        );
        const before = yield* fixture.run(journal);
        const ended = yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        const after = yield* fixture.run(journal);
        expect(ended).toBeNull();
        expect(yield* fixture.run(holdsSecret(connectionId))).toBe(false);
        expect((yield* fixture.run(stored(connectionId))).status).toBe(
          "disconnected"
        );
        expect(Arr.drop(after, before.length)).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              connection: connectionId,
              connector: "drive",
              type: "connection.disconnected",
            },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: connectionId, kind: "connection" },
          },
        ]);
      })
  );

  it.effect(
    "keeps a retried disconnect a no-op, with no second journal entry",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const connectionId = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            drive("school-token")
          )
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        const entries = (yield* fixture.run(journal)).length;
        const retried = yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        expect(retried).toBeNull();
        expect((yield* fixture.run(journal)).length).toBe(entries);
      })
  );

  it.effect(
    "ends a connection whose token is already gone, and journals its end",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const connectionId = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("connectorConnections").insert({
              connector: "drive",
              googleAccountKey: null,
              lastSyncedAt: null,
              nextSyncAt: null,
              owner: { kind: "tenant", tenantId: fixture.tenants.nf },
              scopes: ["drive.file"],
              status: "active",
            })
          )
        );
        yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId, slug: nf });
        expect((yield* fixture.run(stored(connectionId))).status).toBe(
          "disconnected"
        );
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toEqual(["connection.disconnected"]);
      })
  );

  it.effect("lets an Admin end a school connection in a suspended school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(createTenantKey(fixture.tenants.nf));
      const connectionId = yield* fixture.run(
        connect(
          systemActor,
          { kind: "tenant", tenantId: fixture.tenants.nf },
          drive("school-token")
        )
      );
      yield* fixture.run(suspend(fixture.tenants.nf));
      const ended = yield* fixture
        .as("admin")
        .mutation(disconnectSchool, { connectionId, slug: nf });
      expect(ended).toBeNull();
      expect((yield* fixture.run(stored(connectionId))).status).toBe(
        "disconnected"
      );
    })
  );

  it.effect(
    "refuses a teacher's disconnect of a school connection, and another school's connection to this Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        yield* fixture.run(createTenantKey(fixture.tenants.other));
        const own = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            drive("school-token")
          )
        );
        const foreign = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.other },
            drive("other-token")
          )
        );
        const teacher = yield* fixture
          .as("teacher")
          .mutation(disconnectSchool, { connectionId: own, slug: nf })
          .pipe(Effect.flip);
        const otherSchool = yield* fixture
          .as("admin")
          .mutation(disconnectSchool, { connectionId: foreign, slug: nf })
          .pipe(Effect.flip);
        expect([teacher, otherSchool]).toMatchObject([
          denied("role"),
          denied("resource"),
        ]);
        expect((yield* fixture.run(stored(own))).status).toBe("active");
        expect((yield* fixture.run(stored(foreign))).status).toBe("active");
      })
  );

  it.effect(
    "disconnects an account's own personal connection, and refuses another account's, a school's, and a missing one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.users.teacher.userId;
        yield* fixture.run(createTenantKey(fixture.tenants.nf));
        const own = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            drive("teacher-token")
          )
        );
        const school = yield* fixture.run(
          connect(
            systemActor,
            { kind: "tenant", tenantId: fixture.tenants.nf },
            drive("school-token")
          )
        );
        const missing = yield* fixture.run(
          connect(
            { id: teacher, kind: "user" },
            { kind: "personal", userId: teacher },
            drive("removed-token")
          )
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("connectorConnections").delete(missing)
          )
        );
        const byStudent = yield* fixture
          .as("student")
          .mutation(disconnectOwn, { connectionId: own })
          .pipe(Effect.flip);
        const bySchool = yield* fixture
          .as("teacher")
          .mutation(disconnectOwn, { connectionId: school })
          .pipe(Effect.flip);
        const byMissing = yield* fixture
          .as("teacher")
          .mutation(disconnectOwn, { connectionId: missing })
          .pipe(Effect.flip);
        expect([byStudent, bySchool, byMissing]).toMatchObject([
          denied("resource"),
          denied("resource"),
          denied("resource"),
        ]);
        expect(yield* fixture.run(holdsSecret(own))).toBe(true);
        const ended = yield* fixture
          .as("teacher")
          .mutation(disconnectOwn, { connectionId: own });
        expect(ended).toBeNull();
        expect((yield* fixture.run(stored(own))).status).toBe("disconnected");
        expect(yield* fixture.run(holdsSecret(own))).toBe(false);
      })
  );
});
