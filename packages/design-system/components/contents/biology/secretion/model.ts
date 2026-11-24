import { Schema } from "effect";

export const SecretionRouteSchema = Schema.Literals([
  "intracellular",
  "extracellular",
]);
export type SecretionRoute = typeof SecretionRouteSchema.Type;

export const SecretionStepSchema = Schema.Literals([
  "nucleus",
  "freeRibosome",
  "cytoplasm",
  "boundRibosome",
  "reticulum",
  "transport",
  "golgi",
  "secretory",
  "exocytosis",
]);
export type SecretionStep = typeof SecretionStepSchema.Type;

const WaypointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Waypoint = typeof WaypointSchema.Type;

const ROUTE_STEPS: Readonly<Record<SecretionRoute, readonly SecretionStep[]>> =
  {
    extracellular: [
      "nucleus",
      "boundRibosome",
      "reticulum",
      "transport",
      "golgi",
      "secretory",
      "exocytosis",
    ],
    intracellular: ["nucleus", "freeRibosome", "cytoplasm"],
  };

const STEP_WAYPOINTS: Readonly<Record<SecretionStep, Waypoint>> = {
  boundRibosome: [-0.45, 0.28, -0.05],
  cytoplasm: [0.22, 0.25, 0.45],
  exocytosis: [1.38, 0.44, 0.0],
  freeRibosome: [-0.32, 0.28, 0.45],
  golgi: [0.42, 0.34, -0.02],
  nucleus: [-1.05, 0.36, 0.0],
  reticulum: [-0.2, 0.3, -0.14],
  secretory: [0.95, 0.38, 0.02],
  transport: [0.1, 0.34, -0.08],
};

/** Returns the ordered stages played for an intracellular or extracellular enzyme. */
export function stepsForRoute(route: SecretionRoute): readonly SecretionStep[] {
  return ROUTE_STEPS[route];
}

/** Returns the 3D organelle waypoint for one stage of enzyme synthesis or secretion. */
export function waypointOf(step: SecretionStep): Waypoint {
  return STEP_WAYPOINTS[step];
}
