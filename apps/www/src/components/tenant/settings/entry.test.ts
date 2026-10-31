import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Option, Schema } from "effect";
import { setRosterEntryChange } from "@/components/tenant/settings/entry";
import { createLocalStore } from "@/test/optimistic";
import { otherSlug, slug } from "@/test/settings";

const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");
const nisn = Schema.decodeSync(Nisn)("0012345678");

describe("components/tenant/settings/entry", () => {
  it("shows a typed NISN as stored and the flag as set, and keeps a stored NISN when none is typed", () => {
    const local = createLocalStore();
    local.seed(
      roster.entries.get,
      { personId, slug },
      { hasNisn: false, personId }
    );
    setRosterEntryChange(local.store, {
      nisn,
      personId,
      slug,
      underAgeLimit: true,
    });
    expect(
      Option.getOrThrow(
        local.store.getQuery(roster.entries.get, { personId, slug })
      )
    ).toEqual({ hasNisn: true, personId, underAgeLimit: true });
    setRosterEntryChange(local.store, {
      personId,
      slug,
      underAgeLimit: false,
    });
    expect(
      Option.getOrThrow(
        local.store.getQuery(roster.entries.get, { personId, slug })
      )
    ).toEqual({ hasNisn: true, personId, underAgeLimit: false });
  });

  it("leaves another school's row and an unloaded row as they are", () => {
    const local = createLocalStore();
    local.seed(
      roster.entries.get,
      { personId, slug: otherSlug },
      { hasNisn: false, personId }
    );
    setRosterEntryChange(local.store, {
      nisn,
      personId,
      slug,
      underAgeLimit: true,
    });
    expect(local.written()).toEqual([]);
  });
});
