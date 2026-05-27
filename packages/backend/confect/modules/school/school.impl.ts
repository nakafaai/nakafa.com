import { assessmentsLayer } from "@repo/backend/confect/modules/school/assessments/assessments.impl";
import { classesLayer } from "@repo/backend/confect/modules/school/classes/classes.impl";
import { schoolsLayer } from "@repo/backend/confect/modules/school/schools/schools.impl";
import { Layer } from "effect";

export const schoolLayer = Layer.mergeAll(
  classesLayer,
  schoolsLayer,
  assessmentsLayer
);
