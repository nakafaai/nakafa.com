import { useFrame, useThree } from "@react-three/fiber";
import {
  capsuleForms,
  curve,
  EFFERENT,
  kidneyForms,
  TUBULE,
  tubuleForms,
  vesselForms,
} from "@repo/design-system/components/contents/biology/nephron/anatomy";
import type { Solute } from "@repo/design-system/components/contents/biology/nephron/filtration";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { Body } from "@repo/design-system/components/three/organism/body";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { createRef, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { Vector3 } from "three";

/** Where along the tubule the proximal convoluted tubule ends, as a share of its length. */
const PROXIMAL = 0.3;

/** How many particles of each solute the scene keeps moving. */
const POOL = 36;

/** How many seconds a particle takes to pass the whole tubule. */
const TRANSIT = 9;

/**
 * One nephron, its blood supply and the filtrate inside it. Glucose (gold)
 * is filtered in proportion to the plasma glucose; the proximal tubule takes
 * each grain back into the blood until it works at its maximum, and the rest
 * runs on into the urine. Urea (green) is filtered and kept, and bunches up
 * along the duct as the tubule takes water back.
 *
 * @param share - The share of filtered glucose the tubule reabsorbs, 0 to 1
 * @param amount - How much glucose is filtered against the most the lab shows, 0 to 1
 */
export function NephronScene({
  amount,
  share,
  solute,
}: {
  readonly amount: number;
  readonly share: number;
  readonly solute: Solute;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const tubule = useMemo(() => curve(TUBULE), []);
  const efferent = useMemo(() => curve(EFFERENT), []);
  const time = useRef(TRANSIT * 0.55);
  const grains = useMemo(
    () => Arr.map(Arr.range(1, POOL), (id) => ({ id, ref: createRef<Mesh>() })),
    []
  );
  const point = useMemo(() => new Vector3(), []);
  const blood = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    if (playing) {
      time.current += simulationStep(delta);
    }
    Arr.forEach(grains, (grain, index) => {
      const mesh = grain.ref.current;
      if (mesh === null) {
        return;
      }
      const shown = solute === "urea" || hashUnit(index, 41) < amount;
      const run = (time.current / TRANSIT + index / POOL) % 1;
      // Urea slows as water leaves the tubule, so it crowds the duct.
      const along = solute === "urea" ? 1 - (1 - run) ** 1.6 : run;
      tubule.getPointAt(along, point);
      const taken = solute === "glucose" && hashUnit(index, 7) < share;
      const leaves = PROXIMAL * (0.25 + 0.7 * hashUnit(index, 11));
      if (taken && along > leaves) {
        const away = Math.min(1, (along - leaves) * 12);
        tubule.getPointAt(leaves, point);
        efferent.getPointAt(0.32 + 0.1 * hashUnit(index, 3), blood);
        point.lerp(blood, away);
        mesh.visible = shown && away < 1;
      } else {
        mesh.visible = shown;
      }
      mesh.position.copy(point);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <NephronCamera />
      <Body shape={kidneyForms}>
        <Skin
          bump={0.5}
          flesh={BIOLOGY_COLORS.tissueDeep}
          glow={0.25}
          repeat={[1.5, 1.5]}
          roughness={0.7}
          surface="mucosa"
          wet={0.3}
        />
      </Body>
      <Body cast={false} shape={capsuleForms}>
        <Skin
          bump={0.4}
          flesh={BIOLOGY_COLORS.tissuePink}
          glow={0.3}
          repeat={[5, 5]}
          roughness={0.6}
          surface="mucosa"
          wet={0.25}
        />
      </Body>
      <Body cast={false} shape={vesselForms}>
        <Skin
          bump={0.3}
          flesh={BIOLOGY_COLORS.blood}
          glow={0.4}
          repeat={[30, 2]}
          roughness={0.4}
          surface="mucosa"
          wet={0.8}
        />
      </Body>
      <Body cast={false} shape={tubuleForms}>
        <Skin
          bump={0.5}
          flesh={BIOLOGY_COLORS.tissuePink}
          glow={0.08}
          repeat={[80, 2]}
          roughness={0.85}
          surface="mucosa"
          wet={0.08}
        />
      </Body>
      {Arr.map(grains, (grain) => (
        <mesh key={grain.id} ref={grain.ref}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial
            color={
              solute === "glucose"
                ? BIOLOGY_COLORS.glucose
                : BIOLOGY_COLORS.urea
            }
            emissive={
              solute === "glucose"
                ? BIOLOGY_COLORS.glucose
                : BIOLOGY_COLORS.urea
            }
            emissiveIntensity={0.35}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Looks at the whole nephron from the front, farther back on a narrow card. */
function NephronCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 14 : 10.2;
  return (
    <CameraControls
      cameraPosition={[0.6, 0.5, distance]}
      cameraTarget={[0, -0.1, 0]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={2}
    />
  );
}
