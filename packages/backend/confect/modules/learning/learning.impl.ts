import { Layer } from "effect";
import { exercisesLayer } from "./exercises/exercises.impl";

export const learningLayer = Layer.mergeAll(exercisesLayer);
