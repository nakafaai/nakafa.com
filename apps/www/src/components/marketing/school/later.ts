import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/**
 * The sections under the first screen of the School landing, each one's code on
 * its own, so a phone loads only what the reader nears (ADR 0039). The pricing
 * page keeps its own registry beside its plans.
 */
export const schoolSections = {
  closing: laterCode(() =>
    import("@/components/marketing/school/closing").then(
      (module) => module.SchoolClosing
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
