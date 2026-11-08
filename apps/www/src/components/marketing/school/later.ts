import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/**
 * The sections under the first screen of the School pages, each one's code on its
 * own, so a phone loads only what the reader nears (ADR 0039). The pricing page's
 * plans hydrate with the page; its comparison, calculator, add-ons, questions and
 * closing wait here.
 */
export const schoolSections = {
  addons: laterCode(() =>
    import("@/components/marketing/school/pricing/addons").then(
      (module) => module.SchoolAddOns
    )
  ),
  calculator: laterCode(() =>
    import("@/components/marketing/school/pricing/calculator").then(
      (module) => module.SchoolCalculator
    )
  ),
  closing: laterCode(() =>
    import("@/components/marketing/school/closing").then(
      (module) => module.SchoolClosing
    )
  ),
  compare: laterCode(() =>
    import("@/components/marketing/school/pricing/compare").then(
      (module) => module.SchoolCompare
    )
  ),
  exams: laterCode(() =>
    import("@/components/marketing/school/features/exams").then(
      (module) => module.SchoolExams
    )
  ),
  faq: laterCode(() =>
    import("@/components/marketing/school/faq").then(
      (module) => module.SchoolFaq
    )
  ),
  forum: laterCode(() =>
    import("@/components/marketing/school/features/forum").then(
      (module) => module.SchoolForum
    )
  ),
  graduation: laterCode(() =>
    import("@/components/marketing/school/features/graduation").then(
      (module) => module.SchoolGraduation
    )
  ),
  insight: laterCode(() =>
    import("@/components/marketing/school/features/insight").then(
      (module) => module.SchoolInsight
    )
  ),
  library: laterCode(() =>
    import("@/components/marketing/school/features/library").then(
      (module) => module.SchoolLibrary
    )
  ),
  parents: laterCode(() =>
    import("@/components/marketing/school/features/parents").then(
      (module) => module.SchoolParents
    )
  ),
  player: laterCode(() =>
    import("@/components/marketing/school/features/player").then(
      (module) => module.SchoolPlayer
    )
  ),
  reports: laterCode(() =>
    import("@/components/marketing/school/features/reports").then(
      (module) => module.SchoolReports
    )
  ),
  tasks: laterCode(() =>
    import("@/components/marketing/school/features/tasks").then(
      (module) => module.SchoolTasks
    )
  ),
};

/**
 * Loads the code of the School landing's sections. The route opens them before a
 * load that renders the page whole, on the server and on a client navigation, so
 * the page commits with its sections; the first document never runs it, nor does a
 * warm of a link to the page.
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
    openLaterCode(schoolSections.player),
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
