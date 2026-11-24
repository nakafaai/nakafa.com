import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  GasLawThermalLab,
  GasPistonLab,
  GasProcessLab,
  HeatingCurveLab,
  IceMeltingLab,
  SpecificHeatCalorimeterLab,
} from "@/lib/content/renderer/client/physics/heat";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every heat lab of physics, which any lesson in any domain may use. */
export const heatRenderers = [
  {
    name: physicsComponentNames.gasLawThermalLab,
    component: GasLawThermalLab,
  },
  {
    name: physicsComponentNames.gasPistonLab,
    component: GasPistonLab,
  },
  {
    name: physicsComponentNames.gasProcessLab,
    component: GasProcessLab,
  },
  {
    name: physicsComponentNames.heatingCurveLab,
    component: HeatingCurveLab,
  },
  {
    name: physicsComponentNames.iceMeltingLab,
    component: IceMeltingLab,
  },
  {
    name: physicsComponentNames.specificHeatCalorimeterLab,
    component: SpecificHeatCalorimeterLab,
  },
] satisfies readonly RendererImplementation[];
