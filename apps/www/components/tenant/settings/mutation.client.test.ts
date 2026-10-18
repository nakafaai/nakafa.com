import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email, Npsn } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { forSeed } from "@repo/mascot/seed";
import { Array as Arr, Option, Schema } from "effect";
import {
  archivePeriodChange,
  archiveUnitChange,
  assignGrantChange,
  createPeriodChange,
  openPeriodChange,
  removeLogoChange,
  revokeClientChange,
  revokeGrantChange,
  revokeInviteChange,
  setNpsnChange,
  setPolicyChange,
  setUnitLocaleChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation.client";
import type {
  Client,
  Grant,
  Invite,
  Period,
  Unit,
} from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";

type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

const slug = Schema.decodeSync(TenantSlug)("nf");
const otherSlug = Schema.decodeSync(TenantSlug)("other");
const paging = { cursor: null, numItems: 25 };
const later = { cursor: "later", numItems: 25 };
const mascot = forSeed("nf");
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-admin");
const grantedPersonId = Schema.decodeUnknownSync(Id("tenantPeople"))(
  "person-two"
);
const smp = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-smp");
const sma = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-sma");

/** One period as the periods list shows it. */
function period(id: string, start: string, status: Period["status"]): Period {
  return {
    end: "2027-06-30",
    id: Schema.decodeUnknownSync(Id("tenantPeriods"))(id),
    name: id,
    start,
    status,
  };
}

/** One unit as the units list shows it, with its national school number if it has one. */
function unit(id: Unit["id"], npsn: Unit["npsn"] = null): Unit {
  return {
    contentLanguage: "id",
    id,
    level: "smp",
    name: "SMP Nakafa",
    npsn,
    status: "active",
    timeZone: "Asia/Jakarta",
  };
}

/** One pending invite as the invites list shows it. */
function invite(id: string): Invite {
  return {
    email: Schema.decodeSync(Email)("guru@example.com"),
    expiresAt: 1_800_000_000_000,
    id: Schema.decodeUnknownSync(Id("tenantInvites"))(id),
    name: id,
    personId,
  };
}

/** One integration client as the clients list shows it. */
function client(id: string): Client {
  return {
    actions: ["integration.view"],
    createdAt: 1,
    id: Schema.decodeUnknownSync(Id("integrationClients"))(id),
    name: id,
    revokedAt: null,
    rotatedAt: 1,
    scope: { kind: "tenant" },
    status: "active",
  };
}

/** One grant of a person, as the grants of that person show it. */
function grant(id: string, role: Grant["role"]["key"] = "teacher"): Grant {
  return {
    id: Schema.decodeUnknownSync(Id("tenantGrants"))(id),
    role: { key: role, kind: "builtin" },
    scope: { kind: "tenant" },
    term: { kind: "standing" },
  };
}

/** The viewer of the school, as the settings pages read it. */
function viewer(): Viewer {
  return {
    account: { mascot, name: "Admin" },
    can: ["tenant.manage"],
    grants: [],
    person: { id: personId, kind: "member", name: "Admin" },
    tenant: {
      country: "ID",
      currency: "IDR",
      id: Schema.decodeUnknownSync(Id("tenants"))("tenant-nf"),
      kind: "school",
      logo: "stored-logo",
      mascot,
      name: "Nakafa",
      policies: { emailDomains: [], nina: false, studentThreads: false },
      slug,
      status: "active",
    },
    units: [
      {
        contentLanguage: "id",
        id: smp,
        level: "smp",
        name: "SMP Nakafa",
        status: "active",
        timeZone: "Asia/Jakarta",
      },
    ],
  };
}

/** The page of periods of one unit a store holds, or none while it is not loaded. */
function periodsOf(
  local: ReturnType<typeof createLocalStore>,
  unitId: Unit["id"]
) {
  return Option.match(
    local.store.getQuery(tenancy.periods.list, {
      paginationOpts: paging,
      slug,
      unitId,
    }),
    { onNone: () => [], onSome: (result) => result.page }
  );
}

/** One loaded page of periods, as the server answers it. */
const periodPage = (page: Period[]) => ({
  continueCursor: "next",
  isDone: true,
  page,
});

describe("components/tenant/settings/mutation.client", () => {
  describe("the viewer and the units of the school", () => {
    it("shows the policy the school chose at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.viewer.get, { slug }, viewer());
      setPolicyChange(local.store, {
        policy: { key: "nina", value: true },
        slug,
      });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.viewer.get, { slug })
      );
      expect(shown.tenant.policies.nina).toBe(true);
      expect(local.written()).toHaveLength(1);
    });

    it("writes nothing while the viewer of the school is not loaded", () => {
      const local = createLocalStore();
      setPolicyChange(local.store, {
        policy: { key: "nina", value: true },
        slug,
      });
      expect(local.written()).toEqual([]);
    });

    it("takes the logo of the school off at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.viewer.get, { slug }, viewer());
      removeLogoChange(local.store, { slug });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.viewer.get, { slug })
      );
      expect(shown.tenant).not.toHaveProperty("logo");
    });

    it("shows the time zone and content language of a unit in the viewer and the list at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.viewer.get, { slug }, viewer());
      local.seed(tenancy.units.list, { slug }, [unit(smp), unit(sma)]);
      setUnitLocaleChange(local.store, {
        contentLanguage: "en",
        slug,
        timeZone: "Asia/Makassar",
        unitId: smp,
      });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.viewer.get, { slug })
      );
      const listed = Option.getOrThrow(
        local.store.getQuery(tenancy.units.list, { slug })
      );
      expect(shown.units).toEqual([
        expect.objectContaining({
          contentLanguage: "en",
          id: smp,
          timeZone: "Asia/Makassar",
        }),
      ]);
      expect(Arr.map(listed, (item) => [item.id, item.timeZone])).toEqual([
        [smp, "Asia/Makassar"],
        [sma, "Asia/Jakarta"],
      ]);
    });

    it("shows a unit as archived, and as active again, at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.units.list, { slug }, [unit(smp)]);
      archiveUnitChange(local.store, { slug, unitId: smp });
      const archived = Option.getOrThrow(
        local.store.getQuery(tenancy.units.list, { slug })
      );
      expect(Arr.map(archived, (item) => item.status)).toEqual(["archived"]);
      unarchiveUnitChange(local.store, { slug, unitId: smp });
      const restored = Option.getOrThrow(
        local.store.getQuery(tenancy.units.list, { slug })
      );
      expect(Arr.map(restored, (item) => item.status)).toEqual(["active"]);
    });

    it("shows a national school number of eight digits at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.units.list, { slug }, [unit(smp), unit(sma)]);
      setNpsnChange(local.store, { npsn: "20100002", slug, unitId: smp });
      const listed = Option.getOrThrow(
        local.store.getQuery(tenancy.units.list, { slug })
      );
      expect(Arr.map(listed, (item) => item.npsn)).toEqual([
        Schema.decodeSync(Npsn)("20100002"),
        null,
      ]);
    });

    it("shows no national school number that has not eight digits", () => {
      const local = createLocalStore();
      local.seed(tenancy.units.list, { slug }, [unit(smp)]);
      setNpsnChange(local.store, { npsn: "2010", slug, unitId: smp });
      expect(local.written()).toEqual([]);
    });

    it("writes nothing while no unit of the school is loaded", () => {
      const local = createLocalStore();
      setUnitLocaleChange(local.store, {
        contentLanguage: "en",
        slug,
        timeZone: "Asia/Makassar",
        unitId: smp,
      });
      expect(local.written()).toEqual([]);
    });
  });

  describe("the periods of a unit", () => {
    it("lists a new period in the periods of its own unit, as planned, newest start first", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: smp },
        periodPage([period("june", "2027-06-01", "planned")])
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: later, slug, unitId: smp },
        undefined
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: sma },
        periodPage([period("other", "2027-06-01", "planned")])
      );
      createPeriodChange(local.store, {
        end: "2027-08-31",
        name: "April",
        slug,
        start: "2027-04-01",
        unitId: smp,
      });
      expect(
        Arr.map(periodsOf(local, smp), (item) => [item.name, item.status])
      ).toEqual([
        ["june", "planned"],
        ["April", "planned"],
      ]);
      expect(Arr.map(periodsOf(local, sma), (item) => item.name)).toEqual([
        "other",
      ]);
    });

    it("shows a period as open, and as archived, in every loaded list of it", () => {
      const local = createLocalStore();
      const june = period("june", "2027-06-01", "planned");
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: smp },
        periodPage([june])
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: sma },
        periodPage([june])
      );
      openPeriodChange(local.store, { periodId: june.id, slug });
      expect(Arr.map(periodsOf(local, sma), (item) => item.status)).toEqual([
        "active",
      ]);
      archivePeriodChange(local.store, { periodId: june.id, slug });
      expect(Arr.map(periodsOf(local, smp), (item) => item.status)).toEqual([
        "archived",
      ]);
    });
  });

  describe("the invites and the clients of the school", () => {
    it("takes an invite off the pending list of its school only", () => {
      const local = createLocalStore();
      const first = invite("first");
      const second = invite("second");
      const pending = (inviteSlug: typeof slug, page: Invite[]) =>
        local.seed(
          tenancy.invites.list,
          { paginationOpts: paging, slug: inviteSlug },
          { continueCursor: "next", isDone: true, page }
        );
      pending(slug, [first, second]);
      pending(otherSlug, [first]);
      local.seed(
        tenancy.invites.list,
        { paginationOpts: later, slug },
        undefined
      );
      revokeInviteChange(local.store, { inviteId: first.id, slug });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.invites.list, {
          paginationOpts: paging,
          slug,
        })
      );
      const elsewhere = Option.getOrThrow(
        local.store.getQuery(tenancy.invites.list, {
          paginationOpts: paging,
          slug: otherSlug,
        })
      );
      expect(Arr.map(shown.page, (item) => item.id)).toEqual([second.id]);
      expect(Arr.map(elsewhere.page, (item) => item.id)).toEqual([first.id]);
    });

    it("shows a client as revoked, at the time it is revoked, and no other client", () => {
      const local = createLocalStore();
      const first = client("first");
      const second = client("second");
      local.seed(
        integrations.clients.list,
        { paginationOpts: paging, slug },
        { continueCursor: "next", isDone: true, page: [first, second] }
      );
      local.seed(
        integrations.clients.list,
        { paginationOpts: later, slug },
        undefined
      );
      revokeClientChange(local.store, { clientId: first.id, slug });
      const shown = Option.getOrThrow(
        local.store.getQuery(integrations.clients.list, {
          paginationOpts: paging,
          slug,
        })
      );
      expect(Arr.map(shown.page, (item) => item.status)).toEqual([
        "revoked",
        "active",
      ]);
      expect(Arr.map(shown.page, (item) => typeof item.revokedAt)).toEqual([
        "number",
        "object",
      ]);
    });
  });

  describe("the grants of a person", () => {
    it("lists a new grant at the end of the grants of its person only", () => {
      const local = createLocalStore();
      const existing = grant("existing");
      local.seed(access.grants.list, { personId: grantedPersonId, slug }, [
        existing,
      ]);
      local.seed(access.grants.list, { personId, slug }, [existing]);
      local.seed(
        access.grants.list,
        { personId: grantedPersonId, slug: otherSlug },
        undefined
      );
      assignGrantChange(local.store, {
        personId: grantedPersonId,
        role: "counselor",
        scope: { kind: "tenant" },
        slug,
      });
      const granted = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          personId: grantedPersonId,
          slug,
        })
      );
      const untouched = Option.getOrThrow(
        local.store.getQuery(access.grants.list, { personId, slug })
      );
      expect(Arr.map(granted, (item) => item.role.key)).toEqual([
        "teacher",
        "counselor",
      ]);
      expect(Arr.map(untouched, (item) => item.role.key)).toEqual(["teacher"]);
    });

    it("takes a grant off every loaded list of grants at once", () => {
      const local = createLocalStore();
      const first = grant("first");
      const second = grant("second", "staff");
      local.seed(access.grants.list, { personId: grantedPersonId, slug }, [
        first,
        second,
      ]);
      local.seed(access.grants.list, { personId, slug }, [first]);
      revokeGrantChange(local.store, { grantId: first.id, slug });
      const granted = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          personId: grantedPersonId,
          slug,
        })
      );
      const admin = Option.getOrThrow(
        local.store.getQuery(access.grants.list, { personId, slug })
      );
      expect(Arr.map(granted, (item) => item.id)).toEqual([second.id]);
      expect(admin).toEqual([]);
    });
  });
});
