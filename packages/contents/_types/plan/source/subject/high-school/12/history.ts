import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool12HistoryLiberalDemocracyTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/history/liberal-democracy";
import { subjectHighSchool12HistoryMaintainingIndependenceTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/history/maintaining-independence";
import { subjectHighSchool12HistoryNewOrderIndonesiaTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/history/new-order-indonesia";
import { subjectHighSchool12HistoryReformationIndonesiaTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/history/reformation-indonesia";

export const subjectHighSchool12HistoryPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/history",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.history",
  material: "history",
  topics: [
    subjectHighSchool12HistoryMaintainingIndependenceTopic,
    subjectHighSchool12HistoryLiberalDemocracyTopic,
    subjectHighSchool12HistoryNewOrderIndonesiaTopic,
    subjectHighSchool12HistoryReformationIndonesiaTopic,
  ],
});
