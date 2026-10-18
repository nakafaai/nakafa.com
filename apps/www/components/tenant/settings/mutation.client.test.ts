import { describe, expect, it } from "@effect/vitest";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email, Npsn } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  archivePeriodChange,
  archiveUnitChange,
  assignGrantChange,
  createPeriodChange,
  inviteChange,
  openPeriodChange,
  removeLogoChange,
  renamePeriodChange,
  revokeClientChange,
  revokeGrantChange,
  revokeInviteChange,
  setNpsnChange,
  setPolicyChange,
  setUnitLocaleChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation.client";
import {
  type Invite,
  isDraft,
  type Unit,
} from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import {
  client,
  grant,
  grantedPersonId,
  invite,
  later,
  otherSlug,
  pageOf,
  paging,
  period,
  person,
  slug,
  sma,
  smp,
  unit,
  viewer,
} from "@/test/settings";

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
        pageOf([period("june", "2027-06-01", "planned")])
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: later, slug, unitId: smp },
        undefined
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: sma },
        pageOf([period("other", "2027-06-01", "planned")])
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
        pageOf([june])
      );
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: sma },
        pageOf([june])
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

  describe("the grants and the invites of the school", () => {
    it("lists a new grant at the top of the school's grants, with its Person, when the Person is loaded", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.people.list,
        { paginationOpts: paging, slug, status: "active" },
        pageOf([person("person-two", "Dua")])
      );
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug },
        pageOf([])
      );
      local.seed(
        access.grants.list,
        { paginationOpts: later, slug },
        undefined
      );
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug: otherSlug },
        pageOf([grant("existing")])
      );
      assignGrantChange(local.store, {
        personId: grantedPersonId,
        role: "counselor",
        scope: { kind: "tenant" },
        slug,
      });
      const shown = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          paginationOpts: paging,
          slug,
        })
      );
      const elsewhere = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          paginationOpts: paging,
          slug: otherSlug,
        })
      );
      expect(
        Arr.map(shown.page, (item) => [item.person.name, item.role.key])
      ).toEqual([["Dua", "counselor"]]);
      expect(Arr.map(elsewhere.page, (item) => item.id)).toEqual([
        grant("existing").id,
      ]);
    });

    it("writes no grant while its Person is not loaded", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.people.list,
        { paginationOpts: paging, slug, status: "active" },
        undefined
      );
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug },
        pageOf([])
      );
      assignGrantChange(local.store, {
        personId: grantedPersonId,
        role: "counselor",
        scope: { kind: "tenant" },
        slug,
      });
      expect(local.written()).toEqual([]);
    });

    it("takes a grant off every loaded list of the school's grants at once", () => {
      const local = createLocalStore();
      const first = grant("first");
      const second = grant("second", "staff");
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug },
        pageOf([first, second])
      );
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug: otherSlug },
        pageOf([first])
      );
      revokeGrantChange(local.store, { grantId: first.id, slug });
      const shown = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          paginationOpts: paging,
          slug,
        })
      );
      const elsewhere = Option.getOrThrow(
        local.store.getQuery(access.grants.list, {
          paginationOpts: paging,
          slug: otherSlug,
        })
      );
      expect(Arr.map(shown.page, (item) => item.id)).toEqual([second.id]);
      expect(Arr.map(elsewhere.page, (item) => item.id)).toEqual([first.id]);
    });

    it("lists a new invite at the top of the pending invites, marked as a draft, when its Person is loaded", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.people.list,
        { paginationOpts: paging, slug, status: "active" },
        pageOf([person("person-two", "Dua")])
      );
      local.seed(
        tenancy.invites.list,
        { paginationOpts: paging, slug },
        pageOf([invite("lama")])
      );
      inviteChange(local.store, {
        email: Schema.decodeSync(Email)("dua@example.com"),
        locale: "id",
        personId: grantedPersonId,
        slug,
      });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.invites.list, {
          paginationOpts: paging,
          slug,
        })
      );
      expect(
        Arr.map(shown.page, (item) => [item.name, isDraft(item.id)])
      ).toEqual([
        ["Dua", true],
        ["lama", false],
      ]);
    });

    it("writes no invite while its Person is not loaded", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.people.list,
        { paginationOpts: paging, slug, status: "active" },
        undefined
      );
      inviteChange(local.store, {
        email: Schema.decodeSync(Email)("dua@example.com"),
        locale: "id",
        personId: grantedPersonId,
        slug,
      });
      expect(local.written()).toEqual([]);
    });
  });

  describe("the name of a period", () => {
    it("shows a period under its new name at once, in every loaded list of it", () => {
      const local = createLocalStore();
      const june = period("june", "2027-06-01", "planned");
      local.seed(
        tenancy.periods.list,
        { paginationOpts: paging, slug, unitId: smp },
        pageOf([june])
      );
      renamePeriodChange(local.store, {
        name: "Genap 2027",
        periodId: june.id,
        slug,
      });
      expect(Arr.map(periodsOf(local, smp), (item) => item.name)).toEqual([
        "Genap 2027",
      ]);
    });
  });
});
