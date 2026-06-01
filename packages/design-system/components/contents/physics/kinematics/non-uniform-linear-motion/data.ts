import { getColor } from "@repo/design-system/lib/color";

export type GlbbScenarioId = "from-rest" | "speed-up" | "brake";

export interface GlbbScenario {
  acceleration: number;
  color: string;
  duration: number;
  id: GlbbScenarioId;
  initialVelocity: number;
}

export interface GlbbLabels {
  chooseScenario: string;
  scenarioNames: Record<GlbbScenarioId, string>;
  timeAxis: string;
  velocityAxis: string;
}

export const DEFAULT_GLBB_SCENARIO_ID = "from-rest" satisfies GlbbScenarioId;

export const GLBB_SCENARIOS: GlbbScenario[] = [
  {
    id: "from-rest",
    color: getColor("TEAL"),
    initialVelocity: 0,
    acceleration: 2,
    duration: 5,
  },
  {
    id: "speed-up",
    color: getColor("SKY"),
    initialVelocity: 2,
    acceleration: 1,
    duration: 6,
  },
  {
    id: "brake",
    color: getColor("VIOLET"),
    initialVelocity: 12,
    acceleration: -2,
    duration: 5,
  },
];

export function getGlbbScenarioById(id: GlbbScenarioId) {
  return (
    GLBB_SCENARIOS.find((scenario) => scenario.id === id) ?? GLBB_SCENARIOS[0]
  );
}

export function isGlbbScenarioId(value: string): value is GlbbScenarioId {
  return GLBB_SCENARIOS.some((scenario) => scenario.id === value);
}

export function getFinalVelocity(scenario: GlbbScenario) {
  return getVelocityAt(scenario, scenario.duration);
}

export function getVelocityAt(scenario: GlbbScenario, time: number) {
  return scenario.initialVelocity + scenario.acceleration * time;
}
