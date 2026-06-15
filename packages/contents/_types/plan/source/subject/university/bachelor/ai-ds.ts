import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectUniversityBachelorAiDsAdvancedMachineLearningTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/advanced-machine-learning";
import { subjectUniversityBachelorAiDsAiProgrammingTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/ai-programming";
import { subjectUniversityBachelorAiDsComputerVisionTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/computer-vision";
import { subjectUniversityBachelorAiDsLinearMethodsTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/linear-methods";
import { subjectUniversityBachelorAiDsMachineLearningTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/machine-learning";
import { subjectUniversityBachelorAiDsNeuralNetworksTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/neural-networks";
import { subjectUniversityBachelorAiDsNlpTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/nlp";
import { subjectUniversityBachelorAiDsNonlinearOptimizationTopic } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds/nonlinear-optimization";

export const subjectUniversityBachelorAiDsPlan = defineSubjectPlan({
  baseRoute: "subject/university/bachelor/ai-ds",
  category: "university",
  grade: "bachelor",
  kind: "subject",
  key: "subject.university.bachelor.ai-ds",
  material: "ai-ds",
  topics: [
    subjectUniversityBachelorAiDsLinearMethodsTopic,
    subjectUniversityBachelorAiDsAiProgrammingTopic,
    subjectUniversityBachelorAiDsNeuralNetworksTopic,
    subjectUniversityBachelorAiDsMachineLearningTopic,
    subjectUniversityBachelorAiDsNonlinearOptimizationTopic,
    subjectUniversityBachelorAiDsAdvancedMachineLearningTopic,
    subjectUniversityBachelorAiDsComputerVisionTopic,
    subjectUniversityBachelorAiDsNlpTopic,
  ],
});
