import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { notFound } from "@tanstack/react-router";
import { Option } from "effect";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import type { SchoolFrame, SchoolViewer } from "@/lib/tenant/frame";

/** Where a member stands when a capability decides a page: the school's address and the page's path. */
type SchoolPlace = Readonly<
  Record<"pathname", string> & Record<"slug", TenantSlug>
>;

/** Whether a member's roles open a page, as `components/tenant/*\/access.ts` decides it. */
type Opens = (viewer: SchoolViewer, place: SchoolPlace) => boolean;

/** What the guard reads of the layout's frame: whether the viewer is a member, and a member's view. */
type GuardedSchool =
  | Pick<Extract<SchoolFrame, { _tag: "Member" }>, "_tag" | "viewer">
  | Pick<Exclude<SchoolFrame, { _tag: "Member" }>, "_tag">;

/** What a School page's `beforeLoad` receives that its guard reads: the layout's frame, the path and the params. */
type SchoolPage<Params> = Readonly<{
  context: Readonly<
    Record<"school", GuardedSchool> & Record<"slug", TenantSlug>
  >;
  location: Readonly<Record<"pathname", string>>;
  params: Params;
}>;

/** A page that every member may open, or one whose capability the guard reads. */
export function guardSchoolPage(rules: { readonly opens: Opens }): {
  readonly beforeLoad: (page: SchoolPage<unknown>) => void;
  readonly notFoundComponent: typeof SchoolPageNotFound;
};
/** A page whose address names rows, which its context then holds. */
export function guardSchoolPage<Params, Found extends object>(rules: {
  readonly opens?: Opens;
  readonly reads: (params: Params) => Option.Option<Found>;
}): {
  readonly beforeLoad: (page: SchoolPage<Params>) => Found;
  readonly notFoundComponent: typeof SchoolPageNotFound;
};
/**
 * The one guard of a page below a school, spread into its route options. It
 * answers the school's not-found page, inside the school shell, for an address
 * whose rows `reads` cannot name (for every viewer, since such an address names
 * nothing) and for a member whom `opens` does not let in. A visitor and an
 * account that is not a member pass, because the layout draws their page. It is a
 * gate for the interface only: Convex refuses every read the page makes for a
 * viewer who may not make it.
 */
export function guardSchoolPage<Params, Found extends object>(rules: {
  readonly opens?: Opens;
  readonly reads?: (params: Params) => Option.Option<Found>;
}) {
  return {
    beforeLoad: (page: SchoolPage<Params>) => {
      const found = rules.reads?.(page.params);
      if (found !== undefined && Option.isNone(found)) {
        throw notFound();
      }
      const { school, slug } = page.context;
      if (
        rules.opens !== undefined &&
        school._tag === "Member" &&
        !rules.opens(school.viewer, { pathname: page.location.pathname, slug })
      ) {
        throw notFound();
      }
      return found?.value;
    },
    notFoundComponent: SchoolPageNotFound,
  };
}
