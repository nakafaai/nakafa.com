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
});
