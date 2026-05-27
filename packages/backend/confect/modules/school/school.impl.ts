import { Layer } from "effect";
import { assessmentsLayer } from "./assessments/assessments.impl";
import { classesLayer } from "./classes/classes.impl";
import { schoolsLayer } from "./schools/schools.impl";

export const schoolLayer = Layer.mergeAll(
  classesLayer,
  schoolsLayer,
  assessmentsLayer
);
