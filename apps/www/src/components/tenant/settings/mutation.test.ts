import { describe, expect, it } from "@effect/vitest";
import access from "@repo/backend/confect/_generated/refs/access";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email, Npsn } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  addUnitChange,
  archiveUnitChange,
  assignGrantChange,
  inviteChange,
  removeLogoChange,
  revokeClientChange,
  revokeGrantChange,
  revokeInviteChange,
  setNameChange,
  setNpsnChange,
  setPolicyChange,
  setUnitLocaleChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation";
import { type Invite, isDraft } from "@/components/tenant/settings/state";
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
  person,
  slug,
  sma,
  smp,
  unit,
  viewer,
} from "@/test/settings";

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

    it("shows the new name of the school at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.viewer.get, { slug }, viewer());
      setNameChange(local.store, { name: "Yayasan Harapan", slug });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.viewer.get, { slug })
      );
      expect(shown.tenant.name).toBe("Yayasan Harapan");
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

    it("lists a new school at the end of the units at once", () => {
      const local = createLocalStore();
      local.seed(tenancy.units.list, { slug }, [unit(smp), unit(sma)]);
      addUnitChange(local.store, {
        contentLanguage: "id",
        level: "sd",
        name: "SD Nakafa",
        slug,
        timeZone: "Asia/Jakarta",
      });
      const shown = Option.getOrThrow(
        local.store.getQuery(tenancy.units.list, { slug })
      );
      expect(
        Arr.take(
          Arr.map(shown, (item) => item.id),
          2
        )
      ).toEqual([smp, sma]);
      expect(Option.getOrThrow(Arr.get(shown, 2))).toMatchObject({
        contentLanguage: "id",
        level: "sd",
        name: "SD Nakafa",
        npsn: null,
        status: "active",
        timeZone: "Asia/Jakarta",
      });
      expect(shown).toHaveLength(3);
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

    it("lists a new grant on the first loaded page of the grants only", () => {
      const local = createLocalStore();
      local.seed(
        tenancy.people.list,
        { paginationOpts: paging, slug, status: "active" },
        pageOf([person("person-two", "Dua")])
      );
      local.seed(
        access.grants.list,
        { paginationOpts: paging, slug },
        pageOf([grant("existing")])
      );
      local.seed(
        access.grants.list,
        { paginationOpts: later, slug },
        pageOf([grant("older", "staff")])
      );
      assignGrantChange(local.store, {
        personId: grantedPersonId,
        role: "counselor",
        scope: { kind: "tenant" },
        slug,
      });
      const grantsOf = (pagination: typeof paging | typeof later) =>
        Option.getOrThrow(
          local.store.getQuery(access.grants.list, {
            paginationOpts: pagination,
            slug,
          })
        ).page;
      expect(
        Arr.map(grantsOf(paging), (item) => [item.person.name, item.role.key])
      ).toEqual([
        ["Dua", "counselor"],
        ["Admin", "teacher"],
      ]);
      expect(Arr.map(grantsOf(later), (item) => item.role.key)).toEqual([
        "staff",
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

    it("lists a new invite on the first loaded page of the invites only", () => {
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
      local.seed(
        tenancy.invites.list,
        { paginationOpts: later, slug },
        pageOf([invite("tua")])
      );
      inviteChange(local.store, {
        email: Schema.decodeSync(Email)("dua@example.com"),
        locale: "id",
        personId: grantedPersonId,
        slug,
      });
      const invitesOf = (pagination: typeof paging | typeof later) =>
        Arr.map(
          Option.getOrThrow(
            local.store.getQuery(tenancy.invites.list, {
              paginationOpts: pagination,
              slug,
            })
          ).page,
          (item) => item.name
        );
      expect(invitesOf(paging)).toEqual(["Dua", "lama"]);
      expect(invitesOf(later)).toEqual(["tua"]);
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
});
