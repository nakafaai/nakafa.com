import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria/parts";
import { useBiologyItemSelection } from "@repo/design-system/components/contents/biology/context";
import type { BiologyLabProps } from "@repo/design-system/components/contents/biology/lab";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab";
import {
  EnvelopeMaterial,
  useBumpySphere,
} from "@repo/design-system/components/contents/biology/surface";
import { Virion } from "@repo/design-system/components/contents/biology/virus/envelope";
import { PolyhedralVirusModel } from "@repo/design-system/components/contents/biology/virus/parts";
import { BacteriophageModel } from "@repo/design-system/components/contents/biology/virus/phage";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { VIRION_COLORS } from "@repo/design-system/lib/material/virion";
import { Array as Arr } from "effect";
import { CatmullRomCurve3, Vector3 } from "three";

const ROLE_VIEW = {
  cameraPosition: [0, 1.5, 3.18],
  cameraTarget: [0.25, 0.08, 0.16],
  narrowCameraPosition: [0.25, 2.1, 4.5],
} satisfies NarrowCameraPose;
const TARGET_BACTERIA = [
  {
    id: "infected",
    position: [-0.84, -0.06, 0],
    rotation: [0, 0, 0.08],
    showFlagellum: false,
  },
  {
    id: "center",
    position: [0.42, -0.06, 0],
    rotation: [0, 0, -0.08],
    showFlagellum: false,
  },
  {
    id: "right",
    position: [1.34, 0.16, -0.12],
    rotation: [0, 0, 0.16],
    showFlagellum: true,
  },
] as const;

/**
 * Renders the virus role lab with pathogenic, ecological, and biotechnology modes.
 */
export function VirusRoleLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusRoleScene} view={ROLE_VIEW} {...props} />;
}

/**
 * Changes the whole scene so students do not read all virus roles as disease.
 */
function VirusRoleScene() {
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);

  if (selectedIndex === 1) {
    return (
      <group scale={0.86}>
        <EcologyRole />
      </group>
    );
  }

  if (selectedIndex === 2) {
    return (
      <group scale={0.86}>
        <BiotechRole />
      </group>
    );
  }

  return (
    <group scale={0.86}>
      <PathogenRole />
    </group>
  );
}

/** Where on a host cell's surface, an ellipsoid of the given half-widths, the point above (x, z) lies, lifted by `lift`. */
function onCell(
  [width, height, depth]: readonly [number, number, number],
  x: number,
  z: number,
  lift: number
) {
  const inside = 1 - (x / width) ** 2 - (z / depth) ** 2;
  return [x, height * Math.sqrt(Math.max(0, inside)) + lift, z] as const;
}

/** The host cell of the disease and the biotechnology views: a living cell's soft, uneven membrane. */
function HostCell({
  position,
  size,
}: {
  readonly position: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}) {
  const cell = useBumpySphere(1, 6, 0.02);
  return (
    <mesh
      castShadow
      geometry={cell}
      position={position}
      receiveShadow
      scale={size}
    >
      <EnvelopeMaterial clip={undefined} color={CELL_COLORS.membrane} />
    </mesh>
  );
}

/** The infected cell's shape in the disease view. */
const INFECTED = [1.2, 0.78, 0.78] as const;

/**
 * Shows virus damage: SARS-CoV-2 virions docked all over a host cell and one
 * budding from it, a new particle wrapped in the cell's own membrane.
 */
function PathogenRole() {
  return (
    <group>
      <HostCell position={[0, 0, 0]} size={INFECTED} />
      {Arr.map([-0.8, -0.38, 0.05, 0.52, 0.9], (x, index) => (
        <group
          key={x}
          position={onCell(
            INFECTED,
            x,
            0.32 + index * 0.02,
            index === 2 ? 0.05 : 0.15
          )}
          rotation={[index, index * 0.6, 0]}
          scale={0.16}
        >
          <Virion />
        </group>
      ))}
    </group>
  );
}

/** Phages landed on the infected bacterium, in its own frame. */
const LANDED = [
  { id: "left", position: [-0.26, 0.36, 0.02], rotation: [0.1, 0, 0.3] },
  { id: "middle", position: [0.04, 0.37, -0.04], rotation: [-0.12, 0.5, 0] },
  { id: "right", position: [0.3, 0.36, 0.04], rotation: [0.15, 1, -0.28] },
] as const;

/**
 * Shows bacteriophages linking viruses to microbial population control:
 * three phages landed on one bacterium, their tails contracted, beside
 * bacteria they have not reached yet.
 */
function EcologyRole() {
  return (
    <group>
      {Arr.map(TARGET_BACTERIA, (bacterium) => (
        <group
          key={bacterium.id}
          position={bacterium.position}
          rotation={bacterium.rotation}
        >
          <BacillusBacteriumModel
            scale={0.82}
            showFlagellum={bacterium.showFlagellum}
            showInterior={false}
            showPili={false}
          />
          {bacterium.id === "infected"
            ? Arr.map(LANDED, ({ id, position, rotation }) => (
                <group key={id} position={position} rotation={rotation}>
                  <BacteriophageModel landed scale={0.4} />
                </group>
              ))
            : null}
        </group>
      ))}
    </group>
  );
}

/** The gene the vector delivers, threading from the capsid into the target cell. */
const GENE = new CatmullRomCurve3(
  Arr.map(
    [
      [-0.3, 0.1, 0.3],
      [-0.12, 0.16, 0.32],
      [0.02, 0.06, 0.3],
      [0.14, 0.12, 0.26],
      [0.26, 0.04, 0.2],
    ] as const,
    (point) => new Vector3(...point)
  )
);

/**
 * Shows a viral vector carrying a gene into a target cell: an adenovirus
 * whose genome has been swapped for a useful gene, delivering it through the
 * membrane.
 */
function BiotechRole() {
  return (
    <group>
      <HostCell position={[0.9, 0, 0]} size={[0.82, 0.62, 0.62]} />
      <group position={[-0.44, 0.1, 0.32]}>
        <PolyhedralVirusModel scale={0.55} />
      </group>
      <mesh castShadow>
        <tubeGeometry args={[GENE, 80, 0.014, 6, false]} />
        <meshStandardMaterial
          color={VIRION_COLORS.nucleicAcid}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}
