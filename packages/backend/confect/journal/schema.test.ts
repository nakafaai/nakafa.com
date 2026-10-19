import { describe, expect, it } from "@effect/vitest";
import { JournalEntry } from "@repo/backend/confect/journal/schema";
import { Schema } from "effect";

describe("journal/schema", () => {
  it("accepts a change under the subject kind that holds it", () => {
    expect(
      Schema.is(JournalEntry)({
        actor: { kind: "system" },
        change: { invite: "invite", type: "person.invited" },
        owner: { kind: "tenant", tenantId: "tenant" },
        subject: { id: "person", kind: "person" },
      })
    ).toBe(true);
  });

  it("refuses a change under a subject of another kind", () => {
    expect(
      Schema.is(JournalEntry)({
        actor: { kind: "system" },
        change: { invite: "invite", type: "person.invited" },
        owner: { kind: "tenant", tenantId: "tenant" },
        subject: { id: "unit", kind: "unit" },
      })
    ).toBe(false);
  });

  it("accepts each connection change under the connection it names, for a school or an account", () => {
    for (const type of [
      "connection.connected",
      "connection.disconnected",
      "connection.reconnect",
    ]) {
      const change = { connection: "connection", connector: "drive", type };
      expect(
        Schema.is(JournalEntry)({
          actor: { kind: "system" },
          change,
          owner: { kind: "tenant", tenantId: "tenant" },
          subject: { id: "connection", kind: "connection" },
        })
      ).toBe(true);
      expect(
        Schema.is(JournalEntry)({
          actor: { id: "user", kind: "user" },
          change,
          owner: { kind: "personal", userId: "user" },
          subject: { id: "connection", kind: "connection" },
        })
      ).toBe(true);
    }
  });

  it("refuses a connection change under a subject of another kind", () => {
    expect(
      Schema.is(JournalEntry)({
        actor: { kind: "system" },
        change: {
          connection: "connection",
          connector: "drive",
          type: "connection.connected",
        },
        owner: { kind: "tenant", tenantId: "tenant" },
        subject: { id: "integration", kind: "integration" },
      })
    ).toBe(false);
  });

  it("accepts a grade's release under the grade it releases", () => {
    expect(
      Schema.is(JournalEntry)({
        actor: { id: "teacher", kind: "person" },
        change: {
          classId: "class",
          periodId: "period",
          personId: "student",
          state: "released",
          type: "grade.released",
        },
        owner: { kind: "tenant", tenantId: "tenant" },
        subject: { id: "grade", kind: "grade" },
      })
    ).toBe(true);
  });
});
