import type { Id } from "@repo/backend/confect/_generated/id";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";

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
  return {
    from: LOCALE_ROUTE,
    params: { slug },
    to: "/school/$slug",
  } satisfies LinkTarget;
}

/** The school's exam list, which the school's exams page owns. */
export function schoolExamsTarget(slug: TenantSlug): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { slug },
    to: "/school/$slug/exams",
  } satisfies LinkTarget;
}

/** The page of one exam. */
export function schoolExamTarget(slug: TenantSlug, exam: string): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { exam, slug },
    to: "/school/$slug/exams/$exam",
  } satisfies LinkTarget;
}

/** The editor of one exam. */
export function schoolExamEditTarget(
  slug: TenantSlug,
  exam: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { exam, slug },
    to: "/school/$slug/exams/$exam/edit",
  } satisfies LinkTarget;
}

/** One sitting of an exam, which its own page shows. */
export function schoolExamSittingTarget(
  slug: TenantSlug,
  exam: string,
  sitting: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { exam, sitting, slug },
    to: "/school/$slug/exams/$exam/sittings/$sitting",
  } satisfies LinkTarget;
}

/** The results of one sitting of an exam. */
export function schoolExamSittingResultsTarget(
  slug: TenantSlug,
  exam: string,
  sitting: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { exam, sitting, slug },
    to: "/school/$slug/exams/$exam/sittings/$sitting/results",
  } satisfies LinkTarget;
}

/** One sitting of a student, which the sitting's own route owns. */
export function schoolSittingTarget(
  slug: TenantSlug,
  sitting: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { sitting, slug },
    to: "/school/$slug/sittings/$sitting",
  } satisfies LinkTarget;
}

/** One class of the school, by its class slug. */
export function schoolClassTarget(
  slug: TenantSlug,
  classSlug: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { classSlug, slug },
    to: "/school/$slug/classes/$classSlug",
  } satisfies LinkTarget;
}

/** The forum of one class of a school, with its channel list. */
export function schoolClassForumTarget(
  slug: TenantSlug,
  classSlug: string
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { classSlug, slug },
    to: "/school/$slug/classes/$classSlug/forum",
  } satisfies LinkTarget;
}

/** One channel of a class's forum, by the channel's ID. */
export function schoolClassChannelTarget(
  slug: TenantSlug,
  classSlug: string,
  channel: Id<"classroomChannels">
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { classSlug, slug },
    search: { channel },
    to: "/school/$slug/classes/$classSlug/forum",
  } satisfies LinkTarget;
}

/** One numbered discussion of a class's forum, by its number (ADR 0026). */
export function schoolClassDiscussionTarget(
  slug: TenantSlug,
  classSlug: string,
  number: number
): LinkTarget {
  return {
    from: LOCALE_ROUTE,
    params: { classSlug, number: String(number), slug },
    to: "/school/$slug/classes/$classSlug/forum/$number",
  } satisfies LinkTarget;
}
