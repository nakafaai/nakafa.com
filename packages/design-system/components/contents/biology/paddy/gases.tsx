import { useFrame } from "@react-three/fiber";
import { usePaddy } from "@repo/design-system/components/contents/biology/paddy/context";
import {
  ROOT,
  SLICE,
} from "@repo/design-system/components/contents/biology/paddy/lens";
import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import {
  channelOxygen,
  rootState,
  soilOxygen,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

/** How far behind its base, in metres, the magnified slice is cut from its root. */
export const SECTION_DEPTH = 0.12;

/** The most of each kind of particle the slice ever shows. */
const MOST = {
  channel: 14,
  ethanol: 18,
  inward: 10,
  leak: 6,
  released: 10,
} as const;

/** Seconds a particle takes over its path, for each kind. */
const PERIOD = {
  channel: 3.2,
  ethanol: 9,
  inward: 4.5,
  leak: 4,
  released: 5,
} as const;

/** How big each particle is, in radii of the disc. */
const SIZE = 0.026;

/**
 * What the model says the slice's cells do, drained and flooded: the oxygen
 * in rice's air channels, the soil's oxygen when drained, and the ethanol
 * made per glucose either way, at the slice's depth.
 */
function sliceRates(plant: Plant, atp: number) {
  return {
    channel: plant === "rice" ? channelOxygen(plant, SECTION_DEPTH) : 0,
    drained: rootState(plant, "drained", SECTION_DEPTH, atp).ethanol,
    flooded: rootState(plant, "flooded", SECTION_DEPTH, atp).ethanol,
    soil: soilOxygen("drained", SECTION_DEPTH),
  };
}

/**
 * How many of each particle the slice shows at a degree of flooding: oxygen
 * flowing along rice's air channels, oxygen leaking out of a flooded rice
 * root or seeping in from drained soil, carbon dioxide released by every
 * living cell, and ethanol from cells that ferment, eased between drained
 * and flooded.
 */
function particleCounts(
  plant: Plant,
  rates: ReturnType<typeof sliceRates>,
  flood: number
) {
  const ethanol = rates.drained + (rates.flooded - rates.drained) * flood;
  return {
    channel: Math.round(MOST.channel * rates.channel),
    ethanol: Math.round((MOST.ethanol * ethanol) / 2),
    inward: Math.round(MOST.inward * rates.soil * (1 - flood)),
    leak: plant === "rice" ? Math.round(MOST.leak * flood) : 0,
    released: MOST.released,
  };
}

/** Where along its path, from 0 to 1, particle `index` of a kind is at `time`, and how large it shows. */
function phase(index: number, seed: number, time: number, period: number) {
  const u = (time / period + hashUnit(index, seed)) % 1;
  return { scale: Math.sin(Math.PI * u) ** 0.5, u };
}

/**
 * The gases and the alcohol in the magnified slice, moving as they would:
 * oxygen down rice's air channels along the root and out into the mud near
 * the tip, oxygen in from drained soil, carbon dioxide out of every living
 * cell, and ethanol building up where cells ferment. Their numbers follow
 * the model. Paused, each stands where it was, so the still slice still
 * shows what each root does.
 */
export function Gases({ atp }: { readonly atp: number }) {
  const { clock, flood, plant } = usePaddy();
  const oxygen = useRef<InstancedMesh>(null);
  const carbon = useRef<InstancedMesh>(null);
  const ethanol = useRef<InstancedMesh>(null);
  const rates = useMemo(() => sliceRates(plant, atp), [atp, plant]);
  const scratch = useMemo(
    () => ({
      matrix: new Matrix4(),
      position: new Vector3(),
      scale: new Vector3(),
      turn: new Quaternion(),
    }),
    []
  );

  useFrame(() => {
    const time = clock.current;
    const counts = particleCounts(plant, rates, flood.current);
    const place = (
      mesh: InstancedMesh,
      slot: number,
      x: number,
      y: number,
      z: number,
      size: number
    ) => {
      scratch.matrix.compose(
        scratch.position.set(x, y, z),
        scratch.turn,
        scratch.scale.setScalar(Math.max(1e-4, size * SIZE))
      );
      mesh.setMatrixAt(slot, scratch.matrix);
    };
    const air = oxygen.current;
    const gas = carbon.current;
    const alcohol = ethanol.current;
    if (air === null || gas === null || alcohol === null) {
      return;
    }
    const front = SLICE / 2 + 0.012;
    Arr.forEach(Arr.range(0, counts.channel - 1), (index) => {
      const { scale, u } = phase(index, 3, time, PERIOD.channel);
      const lacuna = index % 10;
      const angle =
        ((3 * lacuna + 1.5) / 32) * Math.PI * 2 +
        (hashUnit(index, 5) - 0.5) * 0.12;
      const radius = 0.38 + 0.24 * hashUnit(index, 6);
      place(
        air,
        index,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        -SLICE / 2 + SLICE * u,
        scale
      );
    });
    Arr.forEach(Arr.range(0, counts.leak - 1), (index) => {
      const { scale, u } = phase(index, 8, time, PERIOD.leak);
      const angle = ((3 * (index * 2) + 1.5) / 32) * Math.PI * 2;
      const radius = 0.62 + (ROOT + 0.12 - 0.62) * u;
      place(
        air,
        counts.channel + index,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        front,
        scale
      );
    });
    Arr.forEach(Arr.range(0, counts.inward - 1), (index) => {
      const { scale, u } = phase(index, 9, time, PERIOD.inward);
      const angle = hashUnit(index, 10) * Math.PI * 2;
      const radius = 0.95 - 0.5 * u;
      place(
        air,
        counts.channel + counts.leak + index,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        front,
        scale
      );
    });
    air.count = counts.channel + counts.leak + counts.inward;
    Arr.forEach(Arr.range(0, counts.released - 1), (index) => {
      const { scale, u } = phase(index, 11, time, PERIOD.released);
      const angle = hashUnit(index, 12) * Math.PI * 2;
      const radius = 0.2 + 0.85 * u;
      place(
        gas,
        index,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        front,
        scale * 0.85
      );
    });
    gas.count = counts.released;
    Arr.forEach(Arr.range(0, counts.ethanol - 1), (index) => {
      const { u } = phase(index, 13, time, PERIOD.ethanol);
      const angle = hashUnit(index, 14) * Math.PI * 2 + u * 0.3;
      const radius = 0.25 + 0.45 * hashUnit(index, 15) + 0.08 * u;
      place(
        alcohol,
        index,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        front,
        1.05
      );
    });
    alcohol.count = counts.ethanol;
    air.instanceMatrix.needsUpdate = true;
    gas.instanceMatrix.needsUpdate = true;
    alcohol.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        args={[undefined, undefined, MOST.channel + MOST.leak + MOST.inward]}
        ref={oxygen}
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial
          color={PADDY_COLORS.oxygen}
          emissive={PADDY_COLORS.oxygen}
          emissiveIntensity={0.35}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, MOST.released]} ref={carbon}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial
          color={PADDY_COLORS.carbonDioxide}
          emissive={PADDY_COLORS.carbonDioxide}
          emissiveIntensity={0.15}
          roughness={0.35}
        />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, MOST.ethanol]} ref={ethanol}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial
          color={PADDY_COLORS.ethanol}
          emissive={PADDY_COLORS.ethanol}
          emissiveIntensity={0.3}
          roughness={0.3}
        />
      </instancedMesh>
    </>
  );
}
