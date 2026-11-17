import { RoundedBox } from "@react-three/drei";
import {
  type Placement,
  Repeat,
} from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";

/**
 * A laboratory bench with its top at zero: a dark epoxy resin worktop with eased
 * edges over a cabinet of laminate doors with steel pulls, so apparatus
 * stands on furniture rather than on a slab.
 */
export function Bench() {
  return (
    <group>
      <RoundedBox
        args={[2.4, 0.04, 0.9]}
        position={[0, -0.02, -0.15]}
        radius={0.008}
        receiveShadow
        smoothness={2}
      >
        <SurfaceMaterial
          color={BENCH_COLORS.epoxy}
          roughness={0.8}
          surface="plastic"
        />
      </RoundedBox>
      <mesh position={[0, -0.4, -0.17]} receiveShadow>
        <boxGeometry args={[2.3, 0.72, 0.8]} />
        <SurfaceMaterial color={MACHINE_COLORS.laminate} surface="plastic" />
      </mesh>
      <Repeat placements={DOORS}>
        <boxGeometry args={[0.56, 0.62, 0.012]} />
        <SurfaceMaterial color={MACHINE_COLORS.laminate} surface="plastic" />
      </Repeat>
      <Repeat placements={PULLS}>
        <boxGeometry args={[0.012, 0.12, 0.016]} />
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          roughness={0.5}
          surface="brushed"
        />
      </Repeat>
    </group>
  );
}

/** The cabinet's four doors along the bench front. */
const DOORS: readonly Placement[] = Arr.makeBy(4, (index) => ({
  position: [-0.87 + index * 0.58, -0.41, 0.236],
}));

/** One steel pull near the inner edge of each door. */
const PULLS: readonly Placement[] = Arr.makeBy(4, (index) => ({
  position: [
    -0.87 + index * 0.58 + (index % 2 === 0 ? 0.23 : -0.23),
    -0.2,
    0.248,
  ],
}));
