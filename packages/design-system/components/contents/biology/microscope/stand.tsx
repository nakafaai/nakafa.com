import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { STAGE } from "@repo/design-system/components/contents/biology/microscope/form";
import { Microscope } from "@repo/design-system/components/contents/biology/microscope/instrument";
import { Turret } from "@repo/design-system/components/contents/biology/microscope/turret";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";

/** Where the microscope stands on the bench, in metres. */
const SPOT = [0.25, 0, 0.1] as const;

/**
 * The bench's stainless back rail as the microscope's mains flex meets it:
 * the worktop is 0.9 m deep and the rail, 0.016 m deep and 0.052 m high,
 * stands along its back edge.
 */
const RAIL = { behind: 0.9 / 2 - 0.016 + SPOT[2], high: 0.052 } as const;

/**
 * A school compound microscope at real size on the bench, its nosepiece
 * turned to the chosen objective, with that objective's power beside it.
 */
export function MicroscopeStand({
  objective,
  objectives,
}: {
  readonly objective: number;
  readonly objectives: readonly [number, ...number[]];
}) {
  const ink = useLabelInk();

  return (
    <group>
      <StandCamera />
      <LabBench />
      <group position={SPOT}>
        <Microscope rail={RAIL}>
          <Turret objective={objective} objectives={objectives} />
        </Microscope>
        <ThreeLabel
          color={ink}
          fontSize="compact"
          position={[0.17, STAGE.top + 0.115, -0.04]}
        >
          <InlineMath math={`\\times ${objective}`} />
        </ThreeLabel>
      </group>
    </group>
  );
}

/**
 * Looks at the microscope from the front and to one side, from one place
 * at every width, close enough that the instrument fills the card.
 */
function StandCamera() {
  const [x, , z] = SPOT;
  return (
    <CameraControls
      cameraPosition={[x + 0.396, 0.436, z + 0.576]}
      cameraTarget={[x, 0.18, z]}
      fov={36}
      maxDistance={1.3}
      minDistance={0.15}
    />
  );
}
