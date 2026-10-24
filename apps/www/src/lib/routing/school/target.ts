import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { linkOptions } from "@tanstack/react-router";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/*
 * The targets of the school tree. A school page lives under the school's slug,
 * so every target takes the school's slug from the caller, which reads it from
 * the tenant on screen. The school tree is one more part of the app's route
 * tree, so its targets are the app's typed link targets.
 */

/** The home of one school. */
export function schoolHomeTarget(slug: TenantSlug): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { slug },
    to: "/school/$slug",
  });
}

/** The school's exam list, which the school's exams page owns. */
export function schoolExamsTarget(slug: TenantSlug): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { slug },
    to: "/school/$slug/exams",
  });
}

/** The page of one exam. */
export function schoolExamTarget(slug: TenantSlug, exam: string): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { exam, slug },
    to: "/school/$slug/exams/$exam",
  });
}

/** The editor of one exam. */
export function schoolExamEditTarget(
  slug: TenantSlug,
  exam: string
): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { exam, slug },
    to: "/school/$slug/exams/$exam/edit",
  });
}

/** One sitting of an exam, which its own page shows. */
export function schoolExamSittingTarget(
  slug: TenantSlug,
  exam: string,
  sitting: string
): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { exam, sitting, slug },
    to: "/school/$slug/exams/$exam/sittings/$sitting",
  });
}

/** The results of one sitting of an exam. */
export function schoolExamSittingResultsTarget(
  slug: TenantSlug,
  exam: string,
  sitting: string
): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { exam, sitting, slug },
    to: "/school/$slug/exams/$exam/sittings/$sitting/results",
  });
}

/** One sitting of a student, which the sitting's own route owns. */
export function schoolSittingTarget(
  slug: TenantSlug,
  sitting: string
): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { sitting, slug },
    to: "/school/$slug/sittings/$sitting",
  });
}

/** One class of the school, by its class slug. */
export function schoolClassTarget(
  slug: TenantSlug,
  classSlug: string
): LinkTarget {
  return linkOptions({
    from: LOCALE_ROUTE,
    params: { classSlug, slug },
    to: "/school/$slug/classes/$classSlug",
  });
}
