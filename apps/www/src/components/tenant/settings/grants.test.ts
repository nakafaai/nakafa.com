import { describe, expect, it } from "@effect/vitest";
import access from "@repo/backend/confect/_generated/refs/access";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  assignGrantChange,
  givenRoles,
  inviteChange,
  revokeGrantChange,
} from "@/components/tenant/settings/grants";
import { isDraft } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import {
  grant,
  grantedPersonId,
  invite,
  later,
  otherSlug,
  pageOf,
  paging,
  person,
  slug,
} from "@/test/settings";

describe("the roles a viewer gives", () => {
  it("offers an Owner every role but the Integration role, which belongs to a client", () => {
    const roles = givenRoles(Option.some("owner"));

    expect(roles).toContain("owner");
    expect(roles).not.toContain("integration");
  });

  it("keeps the roles that lead the school from anyone else", () => {
    expect(givenRoles(Option.some("teacher"))).not.toContain("owner");
    expect(givenRoles(Option.none())).not.toContain("owner");
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
    local.seed(access.grants.list, { paginationOpts: later, slug }, undefined);
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
