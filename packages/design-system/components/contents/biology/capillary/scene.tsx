import { useThree } from "@react-three/fiber";
import {
  ARTERIOLE,
  BLOCK,
  LYMPH,
  LYMPH_PATH,
  outer,
  VENULE,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { Blood } from "@repo/design-system/components/contents/biology/capillary/blood";
import { tissueCells } from "@repo/design-system/components/contents/biology/capillary/cells";
import { Floor } from "@repo/design-system/components/contents/biology/capillary/floor";
import { TissueFluid } from "@repo/design-system/components/contents/biology/capillary/fluid";
import { LymphCapillary } from "@repo/design-system/components/contents/biology/capillary/lymph";
import type { Bed } from "@repo/design-system/components/contents/biology/capillary/starling";
import { swelling } from "@repo/design-system/components/contents/biology/capillary/starling";
import { TissueCells } from "@repo/design-system/components/contents/biology/capillary/tissue";
import { Vessels } from "@repo/design-system/components/contents/biology/capillary/vessels";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useClipping } from "@repo/design-system/components/contents/biology/surface";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr, Option, Order } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { BackSide, PlaneGeometry } from "three";

/**
 * A block of tissue cut out of the body and opened, seen at about 1000
 * times: an arteriole with its coat of smooth muscle feeds a network of
 * capillaries, red cells squeezing through them in single file; the
 * capillaries drain into a venule; tissue cells rest between them, bathed
 * in tissue fluid; and a blind-ended lymph capillary takes up the fluid the
 * capillaries leave behind. The tissue swells with fluid as the capillaries
 * leave more of it than the lymph drains.
 *
 * @param bed - The pressures of the bed the learner sets
 * @param worst - The bed at the sliders' most filtering ends
 * @param inflow - The share of filtered fluid left for the lymph, 0 to 1
 */
export function CapillaryScene({
  bed,
  inflow,
  labels,
  worst,
}: {
  readonly bed: Bed;
  readonly inflow: number;
  readonly labels: {
    readonly arteriole: ReactNode;
    readonly capillary: ReactNode;
    readonly cell: ReactNode;
    readonly lymph: ReactNode;
    readonly venule: ReactNode;
  };
  readonly worst: Bed;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const amount = swelling(bed, worst);
  useClipping();

  return (
    <group>
      <SimulationTicker running={playing} />
      <CapillaryCamera />
      <Floor />
      <TissueCells />
      <Vessels />
      <Blood />
      <LymphCapillary inflow={inflow} />
      <TissueFluid bed={bed} worst={worst} />
      {amount > 0.01 && <Swelling amount={amount} />}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-7.0, 2 * outer(ARTERIOLE) + 0.3, 1.2]}
      >
        {labels.arteriole}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[7.0, 2 * outer(VENULE) + 0.3, 2.6]}
      >
        {labels.venule}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.4, 0.9, -4.1]}
      >
        {labels.capillary}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[3.5, 2 * outer(LYMPH) + 0.4, LYMPH_PATH.start[2]]}
      >
        {labels.lymph}
      </ThreeLabel>
      <CellLabel ink={ink}>{labels.cell}</CellLabel>
    </group>
  );
}

/**
 * Names a tissue cell of the front row, written just in front of it where
 * nothing else is drawn. The capillary's label sits on the back row, the
 * whole bed away, so the two never meet whichever way the learner turns it.
 */
function CellLabel({
  children,
  ink,
}: {
  readonly children: ReactNode;
  readonly ink: string;
}) {
  const cell = useMemo(
    () =>
      Arr.head(
        Arr.sortWith(
          tissueCells(),
          (candidate) => Math.hypot(candidate.x + 1.5, candidate.z - 6.6),
          Order.Number
        )
      ),
    []
  );
  if (Option.isNone(cell)) {
    return null;
  }
  return (
    <ThreeLabel
      anchorY="top"
      color={ink}
      fontSize="compact"
      position={[cell.value.x, 0.05, cell.value.z + cell.value.radius + 0.1]}
    >
      {children}
    </ThreeLabel>
  );
}

/**
 * The fluid the capillaries leave behind faster than the lymph drains it,
 * pooling over the floor among the cells: the swelling of oedema. It
 * deepens with `amount`, from 0 to 1.
 */
function Swelling({ amount }: { readonly amount: number }) {
  const depth = 0.25 + 1.35 * amount;
  const surface = useMemo(() => {
    const sheet = new PlaneGeometry(
      BLOCK.right - BLOCK.left,
      BLOCK.front - BLOCK.back,
      120,
      114
    );
    sheet.rotateX(-Math.PI / 2);
    const position = sheet.getAttribute("position");
    for (const index of Arr.range(0, position.count - 1)) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, 0.04 * (valueNoise(x * 0.6, z * 0.6, 64) - 0.5));
    }
    sheet.computeVertexNormals();
    return sheet;
  }, []);
  useEffect(() => () => surface.dispose(), [surface]);
  const centre = [
    (BLOCK.left + BLOCK.right) / 2,
    (BLOCK.back + BLOCK.front) / 2,
  ] as const;
  return (
    <group>
      <mesh geometry={surface} position={[centre[0], depth, centre[1]]}>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color={CAPILLARY_COLORS.tissueFluid}
          depthWrite={false}
          opacity={0.16 + 0.14 * amount}
          roughness={0.05}
          transparent
        />
      </mesh>
      <mesh position={[centre[0], depth / 2, centre[1]]}>
        <boxGeometry
          args={[BLOCK.right - BLOCK.left, depth, BLOCK.front - BLOCK.back]}
        />
        <meshPhysicalMaterial
          color={CAPILLARY_COLORS.tissueFluid}
          depthWrite={false}
          opacity={0.06 + 0.08 * amount}
          roughness={0.1}
          side={BackSide}
          transparent
        />
      </mesh>
    </group>
  );
}

/** Looks down on the bed from the front and above, farther back on a narrow card. */
function CapillaryCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 37 : 31;
  const rise = narrow ? 0.8 : 0.7;
  return (
    <CameraControls
      cameraPosition={[
        0.8,
        distance * rise,
        distance * Math.sqrt(1 - rise * rise) - 1.6,
      ]}
      cameraTarget={[0.3, 0, -1.6]}
      fov={34}
      maxDistance={distance * 1.8}
      minDistance={4}
    />
  );
}
