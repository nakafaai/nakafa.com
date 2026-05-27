import { exercisesLayer } from "@repo/backend/confect/modules/learning/exercises/exercises.impl";
import { Layer } from "effect";

export const learningLayer = Layer.mergeAll(exercisesLayer);
