import { afterEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import identity from "@repo/backend/confect/_generated/refs/identity";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";
import {
  addMemberChange,
  addStudentChange,
  reissueCardChange,
  removeMemberChange,
} from "@/components/tenant/settings/accounts";
import { isDraft, type Member } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import {
  invite,
  later,
  login,
  otherSlug,
  pageOf,
  paging,
  slug,
} from "@/test/settings";

const address = Schema.decodeSync(Email)("guru.baru@example.com");

/** One active member of the school as the members list shows it. */
function member(id: string, name: string): Member {
  return {
    id: Schema.decodeUnknownSync(Id("tenantPeople"))(id),
    name,
    roles: ["teacher"],
    status: "joined",
  };
}

describe("components/tenant/settings/members.client", () => {
  it("shows an added member as invited, with its invite, at the top of the first loaded pages", () => {
    const local = createLocalStore();
    local.seed(
      tenancy.roster.members,
      { paginationOpts: paging, slug },
      pageOf([member("p-lama", "Lama")])
    );
    local.seed(
      tenancy.invites.list,
      { paginationOpts: paging, slug },
      pageOf([invite("lama")])
    );
    addMemberChange(local.store, {
      email: address,
      locale: "id",
      name: "Guru Baru",
      role: "teacher",
      slug,
    });
    const members = Option.getOrThrow(
      local.store.getQuery(tenancy.roster.members, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(
      Arr.map(members.page, (item) => [
        item.name,
        item.status,
        isDraft(item.id),
      ])
    ).toEqual([
      ["Guru Baru", "invited", true],
      ["Lama", "joined", false],
    ]);
    const invites = Option.getOrThrow(
      local.store.getQuery(tenancy.invites.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(
      Arr.map(invites.page, (item) => [item.name, isDraft(item.id)])
    ).toEqual([
      ["Guru Baru", true],
      ["lama", false],
    ]);
  });

  it("leaves the members of another school, a later page, and a list that is not loaded as they are", () => {
    const local = createLocalStore();
    local.seed(
      tenancy.roster.members,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([member("p-lain", "Lain")])
    );
    local.seed(
      tenancy.roster.members,
      { paginationOpts: later, slug },
      pageOf([member("p-nanti", "Nanti")])
    );
    local.seed(
      tenancy.roster.members,
      { paginationOpts: later, slug: otherSlug },
      undefined
    );
    addMemberChange(local.store, {
      email: address,
      locale: "id",
      name: "Guru Baru",
      role: "teacher",
      slug,
    });
    const namesOf = (
      pagination: typeof paging | typeof later,
      school: typeof slug | typeof otherSlug
    ) =>
      Arr.map(
        Option.getOrThrow(
          local.store.getQuery(tenancy.roster.members, {
            paginationOpts: pagination,
            slug: school,
          })
        ).page,
        (item) => item.name
      );
    expect(namesOf(paging, otherSlug)).toEqual(["Lain"]);
    expect(namesOf(later, slug)).toEqual(["Nanti"]);
  });

  it("shows an added student's login at the top of the first loaded page, with a draft person", () => {
    const local = createLocalStore();
    local.seed(
      identity.logins.list,
      { paginationOpts: paging, slug },
      pageOf([login("guru.lama")])
    );
    addStudentChange(local.store, {
      loginName: "siswa.baru",
      name: "Siswa Baru",
      slug,
    });
    const logins = Option.getOrThrow(
      local.store.getQuery(identity.logins.list, {
        paginationOpts: paging,
        slug,
      })
    );
    expect(
      Arr.map(logins.page, (item) => [
        item.loginName,
        item.person.name,
        isDraft(item.person.id),
      ])
    ).toEqual([
      ["siswa.baru", "Siswa Baru", true],
      ["guru.lama", "Siswa guru.lama", false],
    ]);
  });

  it("leaves the logins of another school and of a later page as they are", () => {
    const local = createLocalStore();
    local.seed(
      identity.logins.list,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([login("lain")])
    );
    local.seed(
      identity.logins.list,
      { paginationOpts: later, slug },
      pageOf([login("nanti")])
    );
    addStudentChange(local.store, {
      loginName: "siswa.baru",
      name: "Siswa Baru",
      slug,
    });
    const loginsOf = (
      pagination: typeof paging | typeof later,
      school: typeof slug | typeof otherSlug
    ) =>
      Arr.map(
        Option.getOrThrow(
          local.store.getQuery(identity.logins.list, {
            paginationOpts: pagination,
            slug: school,
          })
        ).page,
        (item) => item.loginName
      );
    expect(loginsOf(paging, otherSlug)).toEqual(["lain"]);
    expect(loginsOf(later, slug)).toEqual(["nanti"]);
  });

  it("takes a removed member off every loaded page of its school, and keeps the other school's list", () => {
    const local = createLocalStore();
    const lama = member("p-lama", "Lama");
    local.seed(
      tenancy.roster.members,
      { paginationOpts: paging, slug },
      pageOf([lama, member("p-baru", "Baru")])
    );
    local.seed(
      tenancy.roster.members,
      { paginationOpts: later, slug },
      pageOf([lama])
    );
    local.seed(
      tenancy.roster.members,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([lama])
    );
    removeMemberChange(local.store, { personId: lama.id, slug });
    const namesOf = (
      pagination: typeof paging | typeof later,
      school: typeof slug | typeof otherSlug
    ) =>
      Arr.map(
        Option.getOrThrow(
          local.store.getQuery(tenancy.roster.members, {
            paginationOpts: pagination,
            slug: school,
          })
        ).page,
        (item) => item.name
      );
    expect(namesOf(paging, slug)).toEqual(["Baru"]);
    expect(namesOf(later, slug)).toEqual([]);
    expect(namesOf(paging, otherSlug)).toEqual(["Lama"]);
  });

  describe("the logins of the school", () => {
    const reissuedId = login("guru.lama").person.id;
    const reissuedAt = Date.UTC(2026, 9, 19, 8, 0, 0);

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows the card of a reissued login as issued now, on every loaded page of the school's logins", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(reissuedAt);
      const local = createLocalStore();
      local.seed(
        identity.logins.list,
        { paginationOpts: paging, slug },
        pageOf([login("guru.lama", 1), login("siswa.baru", 1)])
      );
      local.seed(
        identity.logins.list,
        { paginationOpts: later, slug },
        pageOf([login("guru.lama", 1)])
      );
      reissueCardChange(local.store, { personId: reissuedId, slug });
      const issuedOf = (pagination: typeof paging | typeof later) =>
        Arr.map(
          Option.getOrThrow(
            local.store.getQuery(identity.logins.list, {
              paginationOpts: pagination,
              slug,
            })
          ).page,
          (item) => [item.loginName, item.issuedAt]
        );
      expect(issuedOf(paging)).toEqual([
        ["guru.lama", reissuedAt],
        ["siswa.baru", 1],
      ]);
      expect(issuedOf(later)).toEqual([["guru.lama", reissuedAt]]);
    });

    it("leaves the logins of another school as they are", () => {
      const local = createLocalStore();
      local.seed(
        identity.logins.list,
        { paginationOpts: paging, slug: otherSlug },
        pageOf([login("guru.lama", 1)])
      );
      reissueCardChange(local.store, { personId: reissuedId, slug });
      expect(local.written()).toEqual([]);
      expect(
        Option.getOrThrow(
          local.store.getQuery(identity.logins.list, {
            paginationOpts: paging,
            slug: otherSlug,
          })
        ).page
      ).toEqual([login("guru.lama", 1)]);
    });

    it("writes no login while the school's logins are not loaded", () => {
      const local = createLocalStore();
      reissueCardChange(local.store, { personId: reissuedId, slug });
      expect(local.written()).toEqual([]);
    });
  });
});
