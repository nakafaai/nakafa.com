import { useFrame } from "@react-three/fiber";
import {
  CAPILLARIES,
  CENTRES,
  FRONT,
  reach,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { stageAt } from "@repo/design-system/components/contents/biology/muscle/debt";
import { usePose } from "@repo/design-system/components/contents/biology/muscle/pose";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** How many lactic acid dots each fibre's cut face can hold at the lab's most lactic acid. */
const DOTS = 26;

/**
 * How much of the lactic acid scale a leaving dot spends on its way out: it
 * crosses to the nearest capillary in the first part and rides the blood
 * towards the back of the fascicle in the rest.
 */
const LEAVING = 0.22;

/** How far the blood carries a leaving dot along its capillary before it is out of view, in scene units. */
const CARRIED = 12;

/** Where each dot rests in its fibre's section, the lactic acid level it appears at, and the capillary it leaves by. */
function useSeats() {
  return useMemo(
    () =>
      Arr.flatMap(CENTRES, (centre, fibre) =>
        Arr.map(Arr.range(0, DOTS - 1), (slot) => {
          const angle = hashUnit(fibre * 59 + slot, 3) * Math.PI * 2;
          const depth =
            reach(centre, angle) * 0.82 * Math.sqrt(hashUnit(slot, fibre + 8));
          const point = [
            centre[0] + Math.cos(angle) * depth,
            centre[1] + Math.sin(angle) * depth,
          ] as const;
          const exit = Arr.reduce(
            CAPILLARIES,
            CAPILLARIES[0] ?? point,
            (best, capillary) =>
              Math.hypot(capillary[0] - point[0], capillary[1] - point[1]) <
              Math.hypot(best[0] - point[0], best[1] - point[1])
                ? capillary
                : best
          );
          return {
            exit,
            level: (slot + hashUnit(fibre, slot + 13)) / DOTS,
            point,
          };
        })
      ),
    []
  );
}

/**
 * Lactic acid in the cut fibres: amber dots that appear in the sarcoplasm as
 * the shortfall grows, one for each share of the lab's most lactic acid, and
 * that after exercise cross to the nearest capillary and are carried off
 * towards the venous end, on their way to the liver, as the debt is repaid.
 */
export function Lactate() {
  const pose = usePose();
  const dots = useRef<InstancedMesh>(null);
  const seats = useSeats();
  const holder = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const mesh = dots.current;
    if (mesh === null) {
      return;
    }
    const now = pose.current;
    const recovering = stageAt(now.minute) === "recovery";
    Arr.forEach(seats, (seat, slot) => {
      const away = recovering ? (seat.level - now.lactic) / LEAVING : -1;
      const present = seat.level < now.lactic;
      const leaving = !present && seat.level < now.peak && away < 1;
      const across = Math.min(1, Math.max(0, away / 0.4));
      const along = Math.max(0, (away - 0.4) / 0.6);
      const y = seat.point[0] + (seat.exit[0] - seat.point[0]) * across;
      const z = seat.point[1] + (seat.exit[1] - seat.point[1]) * across;
      holder.position.set(
        (FRONT + 0.01 - along * CARRIED) * now.stretch + now.shift,
        y * now.swell,
        z * now.swell
      );
      const size = present || leaving ? 0.075 * (1 - along * 0.6) : 0;
      holder.scale.set(along > 0 ? size : size * 0.5, size, size);
      holder.updateMatrix();
      mesh.setMatrixAt(slot, holder.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[undefined, undefined, seats.length]}
      frustumCulled={false}
      ref={dots}
    >
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial
        color={MUSCLE_COLORS.lactate}
        emissive={MUSCLE_COLORS.lactate}
        emissiveIntensity={0.45}
        roughness={0.4}
      />
    </instancedMesh>
  );
}
