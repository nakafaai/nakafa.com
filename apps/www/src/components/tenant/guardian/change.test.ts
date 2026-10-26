import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Option, Schema } from "effect";
import {
  type ChildItem,
  type LinkItem,
  revokeLinkChange,
  startLinkChange,
  verifyLinkChange,
  withdrawChange,
} from "@/components/tenant/guardian/change";
import { isDraft } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import {
  later,
  otherSlug,
  pageOf,
  paging,
  person,
  slug,
} from "@/test/settings";

const IBU = Schema.decodeSync(Email)("ibu@example.com");
const studentId = Schema.decodeUnknownSync(Id("tenantPeople"))("student-1");
const linkId = Schema.decodeUnknownSync(Id("guardianLinks"))("link-1");

/** One link as the Staff list shows it. */
const link = (status: LinkItem["status"]): LinkItem => ({
  email: IBU,
  expiresAt: 1_800_000_000_000,
  guardian: {
    id: Schema.decodeUnknownSync(Id("tenantPeople"))("guardian-1"),
    name: "Ibu Siti",
  },
  id: linkId,
  mismatches: 0,
  status,
  student: { id: studentId, name: "Raka" },
});

/** One child as the parent home shows it. */
const child = (status: ChildItem["status"]): ChildItem => ({
  linkId,
  staffCheck: false,
  status,
  student: { id: studentId, name: "Raka" },
});

/** The page of the first list of the school's links, as the store holds it now. */
const firstPageOf = (local: ReturnType<typeof createLocalStore>) =>
  Option.getOrThrow(
    local.store.getQuery(guardians.links.list, { paginationOpts: paging, slug })
  ).page;

describe("components/tenant/guardian/change", () => {
  it("lists a new link at once on the first page, once the picker has its student", () => {
    const local = createLocalStore();
    local.seed(
      guardians.links.list,
      { paginationOpts: paging, slug },
      pageOf([link("verified")])
    );
    local.seed(
      guardians.links.list,
      { paginationOpts: later, slug },
      pageOf([])
    );
    const start = {
      email: IBU,
      guardianName: "Ayah Raka",
      slug,
      studentId,
    };
    startLinkChange(local.store, start);
    expect(local.written()).toEqual([]);
    local.seed(
      tenancy.people.students,
      { paginationOpts: later, slug },
      undefined
    );
    local.seed(
      tenancy.people.students,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([person("student-1", "Bukan Raka")])
    );
    local.seed(
      tenancy.people.students,
      { paginationOpts: paging, slug },
      pageOf([person("student-1", "Raka")])
    );
    startLinkChange(local.store, start);
    const [draft, kept] = firstPageOf(local);
    expect(draft).toMatchObject({
      guardian: { name: "Ayah Raka" },
      status: "pending",
      student: { id: studentId, name: "Raka" },
    });
    expect(isDraft(draft?.id ?? "")).toBe(true);
    expect(kept?.status).toBe("verified");
    expect(local.written()).toHaveLength(1);
  });

  it("shows a link as verified or revoked at once on every loaded page of the school", () => {
    const local = createLocalStore();
    local.seed(
      guardians.links.list,
      { paginationOpts: paging, slug },
      pageOf([link("pending")])
    );
    local.seed(
      guardians.links.list,
      { paginationOpts: paging, slug: otherSlug },
      pageOf([link("pending")])
    );
    local.seed(
      guardians.links.list,
      { paginationOpts: later, slug },
      undefined
    );
    const other = {
      ...link("pending"),
      id: Schema.decodeUnknownSync(Id("guardianLinks"))("link-2"),
    };
    local.seed(
      guardians.links.list,
      { paginationOpts: { cursor: null, numItems: 10 }, slug },
      pageOf([other])
    );
    verifyLinkChange(local.store, { linkId, slug });
    expect(firstPageOf(local)[0]?.status).toBe("verified");
    revokeLinkChange(local.store, { linkId, slug });
    expect(firstPageOf(local)[0]?.status).toBe("revoked");
    expect(
      Option.getOrThrow(
        local.store.getQuery(guardians.links.list, {
          paginationOpts: { cursor: null, numItems: 10 },
          slug,
        })
      ).page
    ).toEqual([other]);
  });

  it("shows a child as withdrawn at once, and writes nothing before the children load", () => {
    const local = createLocalStore();
    withdrawChange(local.store, { linkId, slug });
    expect(local.written()).toEqual([]);
    const sibling = {
      ...child("pending"),
      linkId: Schema.decodeUnknownSync(Id("guardianLinks"))("link-2"),
    };
    local.seed(guardians.family.children, { slug }, [
      child("verified"),
      sibling,
    ]);
    withdrawChange(local.store, { linkId, slug });
    expect(
      Option.getOrThrow(
        local.store.getQuery(guardians.family.children, { slug })
      )
    ).toEqual([child("withdrawn"), sibling]);
  });
});
