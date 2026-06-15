import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool12HistoryLiberalDemocracyTopic } from "@repo/contents/_types/material/source/subject/history/high-school-12/liberal-democracy";
import { subjectHighSchool12HistoryMaintainingIndependenceTopic } from "@repo/contents/_types/material/source/subject/history/high-school-12/maintaining-independence";
import { subjectHighSchool12HistoryNewOrderIndonesiaTopic } from "@repo/contents/_types/material/source/subject/history/high-school-12/new-order-indonesia";
import { subjectHighSchool12HistoryReformationIndonesiaTopic } from "@repo/contents/_types/material/source/subject/history/high-school-12/reformation-indonesia";

export const subjectHighSchool12HistoryMaterial = defineSubjectMaterial({
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
