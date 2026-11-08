import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  TenantProfile,
  TenantSettings,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { isNotFound } from "@tanstack/react-router";
import { Option, Result, Schema } from "effect";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import type { SchoolViewer } from "@/lib/tenant/frame";
import { guardSchoolPage } from "@/lib/tenant/guard";

const SLUG = Schema.decodeSync(TenantSlug)("harapan");
const MASCOT = "cat.0.243e66.right.open";

/** The tenant of the viewer: the school profile with its id and its settings. */
const TenantView = Schema.Struct({
  ...TenantProfile.fields,
  id: Id("tenants"),
  ...TenantSettings.fields,
  setupDone: Schema.Boolean,
});

/** A member with no grant, decoded with the backend schemas; the guard hands it to `opens` unread. */
const VIEWER: SchoolViewer = {
  account: Schema.decodeSync(ViewerAccount)({ mascot: MASCOT, name: "Ayu" }),
  can: [],
  grants: [],
  person: {
    id: Schema.decodeUnknownSync(Id("tenantPeople"))("person-1"),
    kind: "member",
    name: "Ayu",
  },
  reach: [],
  tenant: Schema.decodeUnknownSync(TenantView)({
    country: "ID",
    currency: "IDR",
    id: "tenant-1",
    kind: "school",
    mascot: MASCOT,
    name: "Harapan",
    policies: { emailDomains: [], nina: false, studentThreads: false },
    setupDone: false,
    slug: "harapan",
    status: "active",
  }),
  units: [],
};

const MEMBER = { _tag: "Member", viewer: VIEWER } as const;
const VISITOR = { _tag: "Visitor" } as const;
const OUTSIDER = { _tag: "Outsider" } as const;
const PATHNAME = "/school/harapan/insight";

/** What a page's `beforeLoad` hands the guard for one viewer and its params. */
function pageOf<Params>(
  school: typeof MEMBER | typeof VISITOR | typeof OUTSIDER,
  params: Params
) {
  return {
    context: { school, slug: SLUG },
    location: { pathname: PATHNAME },
    params,
  };
}

/** Runs a guard's `beforeLoad` and answers what it returned, or the not-found signal it threw. */
function run(beforeLoad: () => unknown) {
  return Result.try({ catch: (thrown) => thrown, try: beforeLoad });
}

/** An exam address is digits; anything else names no exam. */
const EXAM_DIGITS = /^\d+$/u;

/** Reads one exam address the way a route's `reads` does: digits name an exam, anything else none. */
const readsExam = (params: { readonly exam: string }) =>
  Option.all({
    examId: EXAM_DIGITS.test(params.exam)
      ? Option.some(Number(params.exam))
      : Option.none(),
  });

describe("guardSchoolPage", () => {
  it("answers the school's not-found page", () => {
    expect(guardSchoolPage({ opens: () => true }).notFoundComponent).toBe(
      SchoolPageNotFound
    );
  });

  it("sends a member whom the capability does not let in to not found, with the school and path it stands at", () => {
    const opens = vi.fn(() => false);
    const { beforeLoad } = guardSchoolPage({ opens });

    const answer = run(() => beforeLoad(pageOf(MEMBER, {})));

    expect(Result.isFailure(answer) && isNotFound(answer.failure)).toBe(true);
    expect(opens).toHaveBeenCalledWith(VIEWER, {
      pathname: PATHNAME,
      slug: SLUG,
    });
  });

  it("opens the page to a member whom the capability lets in", () => {
    const { beforeLoad } = guardSchoolPage({ opens: () => true });

    expect(run(() => beforeLoad(pageOf(MEMBER, {})))).toEqual(
      Result.succeed(undefined)
    );
  });

  it.each([VISITOR, OUTSIDER])(
    "lets a $_tag through, whose page the layout draws",
    (school) => {
      const opens = vi.fn(() => false);
      const { beforeLoad } = guardSchoolPage({ opens });

      expect(run(() => beforeLoad(pageOf(school, {})))).toEqual(
        Result.succeed(undefined)
      );
      expect(opens).not.toHaveBeenCalled();
    }
  );

  it.each([MEMBER, VISITOR, OUTSIDER])(
    "sends a $_tag to not found for an address that names no row",
    (school) => {
      const { beforeLoad } = guardSchoolPage({ reads: readsExam });

      const answer = run(() => beforeLoad(pageOf(school, { exam: "draft" })));

      expect(Result.isFailure(answer) && isNotFound(answer.failure)).toBe(true);
    }
  );

  it("hands the page the rows its address names", () => {
    const { beforeLoad } = guardSchoolPage({ reads: readsExam });

    expect(beforeLoad(pageOf(MEMBER, { exam: "12" }))).toEqual({ examId: 12 });
  });

  it("lets a visitor in at an address that names a row, and keeps out a member the capability refuses there", () => {
    const opens = vi.fn(() => false);
    const { beforeLoad } = guardSchoolPage({ opens, reads: readsExam });

    expect(run(() => beforeLoad(pageOf(VISITOR, { exam: "12" })))).toEqual(
      Result.succeed({ examId: 12 })
    );
    const answer = run(() => beforeLoad(pageOf(MEMBER, { exam: "12" })));
    expect(Result.isFailure(answer) && isNotFound(answer.failure)).toBe(true);
  });
});
