import { MaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { lessonAiDsAiProgrammingMaterial } from "@repo/contents/material/lesson/ai-ds/ai-programming/source";
import { lessonAiDsLinearMethodsMaterial } from "@repo/contents/material/lesson/ai-ds/linear-methods/source";
import { lessonBiologyBiodiversityMaterial } from "@repo/contents/material/lesson/biology/biodiversity/source";
import { lessonBiologyClimateChangeMaterial } from "@repo/contents/material/lesson/biology/climate-change/source";
import { lessonBiologyVirusRoleMaterial } from "@repo/contents/material/lesson/biology/virus-role/source";
import { lessonChemistryBasicChemistryLawsMaterial } from "@repo/contents/material/lesson/chemistry/basic-chemistry-laws/source";
import { lessonChemistryGreenChemistryMaterial } from "@repo/contents/material/lesson/chemistry/green-chemistry/source";
import { lessonChemistryStructureMatterMaterial } from "@repo/contents/material/lesson/chemistry/structure-matter/source";
import { lessonMathematicsAnalyticGeometryMaterial } from "@repo/contents/material/lesson/mathematics/analytic-geometry/source";
import { lessonMathematicsCircleMaterial } from "@repo/contents/material/lesson/mathematics/circle/source";
import { lessonMathematicsCircleArcSectorMaterial } from "@repo/contents/material/lesson/mathematics/circle-arc-sector/source";
import { lessonMathematicsCombinatoricsMaterial } from "@repo/contents/material/lesson/mathematics/combinatorics/source";
import { lessonMathematicsComplexNumberMaterial } from "@repo/contents/material/lesson/mathematics/complex-number/source";
import { lessonMathematicsDataAnalysisProbabilityMaterial } from "@repo/contents/material/lesson/mathematics/data-analysis-probability/source";
import { lessonMathematicsDerivativeFunctionMaterial } from "@repo/contents/material/lesson/mathematics/derivative-function/source";
import { lessonMathematicsExponentialLogarithmMaterial } from "@repo/contents/material/lesson/mathematics/exponential-logarithm/source";
import { lessonMathematicsFunctionCompositionInverseFunctionMaterial } from "@repo/contents/material/lesson/mathematics/function-composition-inverse-function/source";
import { lessonMathematicsFunctionModelingMaterial } from "@repo/contents/material/lesson/mathematics/function-modeling/source";
import { lessonMathematicsFunctionTransformationMaterial } from "@repo/contents/material/lesson/mathematics/function-transformation/source";
import { lessonMathematicsGeometricTransformationMaterial } from "@repo/contents/material/lesson/mathematics/geometric-transformation/source";
import { lessonMathematicsIntegralMaterial } from "@repo/contents/material/lesson/mathematics/integral/source";
import { lessonMathematicsLimitMaterial } from "@repo/contents/material/lesson/mathematics/limit/source";
import { lessonMathematicsLinearEquationInequalityMaterial } from "@repo/contents/material/lesson/mathematics/linear-equation-inequality/source";
import { lessonMathematicsMatrixMaterial } from "@repo/contents/material/lesson/mathematics/matrix/source";
import { lessonMathematicsPolynomialMaterial } from "@repo/contents/material/lesson/mathematics/polynomial/source";
import { lessonMathematicsProbabilityMaterial } from "@repo/contents/material/lesson/mathematics/probability/source";
import { lessonMathematicsQuadraticFunctionMaterial } from "@repo/contents/material/lesson/mathematics/quadratic-function/source";
import { lessonMathematicsSequenceSeriesMaterial } from "@repo/contents/material/lesson/mathematics/sequence-series/source";
import { lessonMathematicsStatisticsFoundationsMaterial } from "@repo/contents/material/lesson/mathematics/statistics-foundations/source";
import { lessonMathematicsStatisticsRegressionMaterial } from "@repo/contents/material/lesson/mathematics/statistics-regression/source";
import { lessonMathematicsTrigonometryMaterial } from "@repo/contents/material/lesson/mathematics/trigonometry/source";
import { lessonMathematicsVectorOperationsMaterial } from "@repo/contents/material/lesson/mathematics/vector-operations/source";
import { lessonPhysicsKinematicsMaterial } from "@repo/contents/material/lesson/physics/kinematics/source";
import { lessonPhysicsMeasurementMaterial } from "@repo/contents/material/lesson/physics/measurement/source";
import { lessonPhysicsRenewableEnergyMaterial } from "@repo/contents/material/lesson/physics/renewable-energy/source";
import { lessonPhysicsVectorMaterial } from "@repo/contents/material/lesson/physics/vector/source";
import { practiceAssessmentSnbtEnglishLanguageMaterial } from "@repo/contents/material/practice/assessment/snbt/english-language/source";
import { practiceAssessmentSnbtGeneralKnowledgeMaterial } from "@repo/contents/material/practice/assessment/snbt/general-knowledge/source";
import { practiceAssessmentSnbtGeneralReasoningMaterial } from "@repo/contents/material/practice/assessment/snbt/general-reasoning/source";
import { practiceAssessmentSnbtIndonesianLanguageMaterial } from "@repo/contents/material/practice/assessment/snbt/indonesian-language/source";
import { practiceAssessmentSnbtMathematicalReasoningMaterial } from "@repo/contents/material/practice/assessment/snbt/mathematical-reasoning/source";
import { practiceAssessmentSnbtQuantitativeKnowledgeMaterial } from "@repo/contents/material/practice/assessment/snbt/quantitative-knowledge/source";
import { practiceAssessmentSnbtReadingAndWritingSkillsMaterial } from "@repo/contents/material/practice/assessment/snbt/reading-and-writing-skills/source";
import { practiceAssessmentTkaMathematicsMaterial } from "@repo/contents/material/practice/assessment/tka/mathematics/source";
import { Schema } from "effect";

const materialSourceInput = [
  lessonAiDsAiProgrammingMaterial,
  lessonAiDsLinearMethodsMaterial,
  lessonBiologyBiodiversityMaterial,
  lessonBiologyClimateChangeMaterial,
  lessonBiologyVirusRoleMaterial,
  lessonChemistryBasicChemistryLawsMaterial,
  lessonChemistryGreenChemistryMaterial,
  lessonChemistryStructureMatterMaterial,
  lessonMathematicsAnalyticGeometryMaterial,
  lessonMathematicsCircleMaterial,
  lessonMathematicsCircleArcSectorMaterial,
  lessonMathematicsCombinatoricsMaterial,
  lessonMathematicsComplexNumberMaterial,
  lessonMathematicsDataAnalysisProbabilityMaterial,
  lessonMathematicsDerivativeFunctionMaterial,
  lessonMathematicsExponentialLogarithmMaterial,
  lessonMathematicsFunctionCompositionInverseFunctionMaterial,
  lessonMathematicsFunctionModelingMaterial,
  lessonMathematicsFunctionTransformationMaterial,
  lessonMathematicsGeometricTransformationMaterial,
  lessonMathematicsIntegralMaterial,
  lessonMathematicsLimitMaterial,
  lessonMathematicsLinearEquationInequalityMaterial,
  lessonMathematicsMatrixMaterial,
  lessonMathematicsPolynomialMaterial,
  lessonMathematicsProbabilityMaterial,
  lessonMathematicsQuadraticFunctionMaterial,
  lessonMathematicsSequenceSeriesMaterial,
  lessonMathematicsStatisticsFoundationsMaterial,
  lessonMathematicsStatisticsRegressionMaterial,
  lessonMathematicsTrigonometryMaterial,
  lessonMathematicsVectorOperationsMaterial,
  lessonPhysicsKinematicsMaterial,
  lessonPhysicsMeasurementMaterial,
  lessonPhysicsRenewableEnergyMaterial,
  lessonPhysicsVectorMaterial,
  practiceAssessmentSnbtEnglishLanguageMaterial,
  practiceAssessmentSnbtGeneralKnowledgeMaterial,
  practiceAssessmentSnbtGeneralReasoningMaterial,
  practiceAssessmentSnbtIndonesianLanguageMaterial,
  practiceAssessmentSnbtMathematicalReasoningMaterial,
  practiceAssessmentSnbtQuantitativeKnowledgeMaterial,
  practiceAssessmentSnbtReadingAndWritingSkillsMaterial,
  practiceAssessmentTkaMathematicsMaterial,
];

/**
 * Source-controlled material registry.
 *
 * Materials own reusable localized assets and learner-facing lesson/practice
 * order. Curriculum and assessment source modules map reusable material keys
 * into program-specific structures.
 */
export const MATERIAL_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(MaterialSourceSchema)
)(materialSourceInput);
