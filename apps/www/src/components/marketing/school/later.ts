import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/**
 * The sections under the first screen of the School pages, each one's code on its
 * own, so a phone loads only what the reader nears (ADR 0039). The pricing page's
 * plans hydrate with the page; its comparison, calculator, add-ons, questions and
 * closing wait here.
 */
export const schoolSections = {
  addons: laterCode(() =>
    import("@/components/marketing/school/addons").then(
      (module) => module.SchoolAddOns
    )
  ),
  calculator: laterCode(() =>
    import("@/components/marketing/school/calculator").then(
      (module) => module.SchoolCalculator
    )
  ),
  closing: laterCode(() =>
    import("@/components/marketing/school/closing").then(
      (module) => module.SchoolClosing
    )
  ),
  compare: laterCode(() =>
    import("@/components/marketing/school/compare").then(
      (module) => module.SchoolCompare
    )
  ),
  exams: laterCode(() =>
    import("@/components/marketing/school/exams").then(
      (module) => module.SchoolExams
    )
  ),
  faq: laterCode(() =>
    import("@/components/marketing/school/faq").then(
      (module) => module.SchoolFaq
    )
  ),
  forum: laterCode(() =>
    import("@/components/marketing/school/forum").then(
      (module) => module.SchoolForum
    )
  ),
  graduation: laterCode(() =>
    import("@/components/marketing/school/graduation").then(
      (module) => module.SchoolGraduation
    )
  ),
  insight: laterCode(() =>
    import("@/components/marketing/school/insight").then(
      (module) => module.SchoolInsight
    )
  ),
  library: laterCode(() =>
    import("@/components/marketing/school/library").then(
      (module) => module.SchoolLibrary
    )
  ),
  parents: laterCode(() =>
    import("@/components/marketing/school/parents").then(
      (module) => module.SchoolParents
    )
  ),
  reports: laterCode(() =>
    import("@/components/marketing/school/reports").then(
      (module) => module.SchoolReports
    )
  ),
  tasks: laterCode(() =>
    import("@/components/marketing/school/tasks").then(
      (module) => module.SchoolTasks
    )
  ),
};

/**
 * Loads the code of the School landing's sections. A route's loader runs only
 * where the page renders whole, on the server and on a client navigation, so the
 * page commits with its sections; the first document never runs it.
 */
export function openSchoolLanding() {
  return Promise.all([
    openLaterCode(schoolSections.closing),
    openLaterCode(schoolSections.exams),
    openLaterCode(schoolSections.faq),
    openLaterCode(schoolSections.forum),
    openLaterCode(schoolSections.graduation),
    openLaterCode(schoolSections.insight),
    openLaterCode(schoolSections.library),
    openLaterCode(schoolSections.parents),
    openLaterCode(schoolSections.reports),
    openLaterCode(schoolSections.tasks),
  ]);
}

/** Loads the code of the School pricing page's later sections, as `openSchoolLanding` does for the landing. */
export function openSchoolPricing() {
  return Promise.all([
    openLaterCode(schoolSections.addons),
    openLaterCode(schoolSections.calculator),
    openLaterCode(schoolSections.closing),
    openLaterCode(schoolSections.compare),
    openLaterCode(schoolSections.faq),
  ]);
}
