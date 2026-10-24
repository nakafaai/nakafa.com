import { linkOptions } from "@tanstack/react-router";
import { SCHOOL_ROUTE, type SchoolLinkTarget } from "@/lib/routing/school/link";

/** The school's exam list, which the school's exams page owns. */
export function schoolExamsTarget(): SchoolLinkTarget {
  return linkOptions({ from: SCHOOL_ROUTE, to: "/school/$slug/exams" });
}

/** The page of one exam. */
export function schoolExamTarget(exam: string): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { exam },
    to: "/school/$slug/exams/$exam",
  });
}

/** The editor of one exam. */
export function schoolExamEditTarget(exam: string): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { exam },
    to: "/school/$slug/exams/$exam/edit",
  });
}

/** One sitting of an exam, which its own page shows. */
export function schoolExamSittingTarget(
  exam: string,
  sitting: string
): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { exam, sitting },
    to: "/school/$slug/exams/$exam/sittings/$sitting",
  });
}

/** The results of one sitting of an exam. */
export function schoolExamSittingResultsTarget(
  exam: string,
  sitting: string
): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { exam, sitting },
    to: "/school/$slug/exams/$exam/sittings/$sitting/results",
  });
}

/** One sitting of a student, which the sitting's own route owns. */
export function schoolSittingTarget(sitting: string): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { sitting },
    to: "/school/$slug/sittings/$sitting",
  });
}

/** One class of the school, by its class slug. */
export function schoolClassTarget(classSlug: string): SchoolLinkTarget {
  return linkOptions({
    from: SCHOOL_ROUTE,
    params: { classSlug },
    to: "/school/$slug/classes/$classSlug",
  });
}
