import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectUniversityBachelorAiDsAdvancedMachineLearningTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/advanced-machine-learning";
import { subjectUniversityBachelorAiDsAiProgrammingTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/ai-programming";
import { subjectUniversityBachelorAiDsComputerVisionTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/computer-vision";
import { subjectUniversityBachelorAiDsLinearMethodsTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/linear-methods";
import { subjectUniversityBachelorAiDsMachineLearningTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/machine-learning";
import { subjectUniversityBachelorAiDsNeuralNetworksTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/neural-networks";
import { subjectUniversityBachelorAiDsNlpTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/nlp";
import { subjectUniversityBachelorAiDsNonlinearOptimizationTopic } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor/nonlinear-optimization";

export const subjectUniversityBachelorAiDsMaterial = defineSubjectMaterial({
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
