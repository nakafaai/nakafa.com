import { useFrame } from "@react-three/fiber";
import {
  BILAYER,
  CHANNELS,
  FIELD,
  RECEPTOR,
  ROW,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { useSynapse } from "@repo/design-system/components/contents/biology/synapse/context";
import {
  SHOWN,
  topNormal,
} from "@repo/design-system/components/contents/biology/synapse/dendrite";
import {
  CROSSING,
  phaseOf,
  receptorsAt,
  synapseTime,
  transmitterAt,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/** Ions drawn about six times their hydrated size, so they show: Ca2+ a little larger than Na+. */
const SIZE = { calcium: 0.26, sodium: 0.21 };

/** Ca2+ ions waiting in the cleft under each channel. */
const PER_CHANNEL = 2;

/** Na+ ions streaming through each open receptor at a time. */
const PER_RECEPTOR = 3;

/** How a share of a step eases in and out. */
function ease(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * The Ca2+ ions: waiting in the cleft under the active zone's channels,
 * they enter through the open channels as the impulse arrives, drift to the
 * docked vesicles' sensors, and are taken up again before the next impulse,
 * while new ones gather in the cleft.
 */
export function Calcium() {
  const { clock } = useSynapse();
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const ions = useMemo(
    () =>
      Arr.flatMap(CHANNELS, (channel, index) =>
        Arr.map(Arr.range(0, PER_CHANNEL - 1), (slot) => ({
          channel,
          delay: 0.12 * slot + 0.08 * hashUnit(index, slot),
          side: [
            0.9 * (hashUnit(index, slot + 3) - 0.5),
            0.6 * hashUnit(index, slot + 5),
            -0.7 * hashUnit(index, slot + 7),
          ] as const,
        }))
      ),
    []
  );

  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const { within } = phaseOf(clock.current);
    Arr.forEach(ions, (ion, index) => {
      const [cx, cy, cz] = ion.channel;
      const [sx, sy, sz] = ion.side;
      const enter = ease((within - 0.55 - ion.delay) / 0.45);
      const settle = ease((within - 1.05 - ion.delay) / 0.4);
      const gone =
        ease((within - 2.2) / 0.4) * (1 - ease((within - 3.8) / 0.5));
      const waiting = cy - 1.05 - sy;
      const inside = cy + BILAYER + 0.95;
      const y = waiting + (inside - waiting) * enter + 0.5 * settle;
      const spread = 1 - Math.min(1, Math.abs(y - cy - BILAYER / 2) / 0.9);
      dummy.position.set(
        cx + sx * (1 - spread) + 0.6 * settle * Math.sign(sx),
        y,
        Math.min(cz + sz * (1 - spread) - 0.7 * settle, ROW.channel + 0.5)
      );
      dummy.scale.setScalar(SIZE.calcium * Math.max(0.001, 1 - gone));
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh args={[undefined, undefined, ions.length]} ref={mesh}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshPhysicalMaterial
        clearcoat={0.8}
        color={SYNAPSE_COLORS.calcium}
        emissive={SYNAPSE_COLORS.calcium}
        emissiveIntensity={0.25}
        roughness={0.3}
      />
    </instancedMesh>
  );
}

/**
 * The Na+ ions: streaming from the cleft down through each open receptor's
 * channel into the dendrite, which is the current that depolarises it.
 */
export function Sodium() {
  const { clock, rate, treatment } = useSynapse();
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const open = useRef<readonly boolean[]>(Arr.makeBy(SHOWN, () => false));
  const step = useRef(-1);
  const shown = Arr.take(FIELD, SHOWN);

  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const now = Math.round(clock.current * 20);
    if (now !== step.current) {
      step.current = now;
      const time = synapseTime(clock.current, rate);
      open.current = Arr.map(
        receptorsAt(
          transmitterAt(time - CROSSING, rate, treatment),
          treatment,
          SHOWN
        ),
        (receptor) => receptor.open
      );
    }
    const { within } = phaseOf(clock.current);
    Arr.forEach(shown, ([x, y, z], receptor) => {
      const [, ny, nz] = topNormal(z);
      Arr.forEach(Arr.range(0, PER_RECEPTOR - 1), (slot) => {
        const index = receptor * PER_RECEPTOR + slot;
        const share =
          (within * 0.9 + slot / PER_RECEPTOR + hashUnit(receptor, 2)) % 1;
        const height = RECEPTOR.above + 1.1 - share * (RECEPTOR.length + 1.25);
        const funnel = Math.min(
          1,
          Math.abs(height - (RECEPTOR.above - RECEPTOR.length) / 2) / 1.6
        );
        const angle = 2.4 * slot + receptor;
        dummy.position.set(
          x + 0.55 * funnel * Math.cos(angle),
          y + height * ny,
          z + height * nz + 0.4 * funnel * Math.sin(angle) - 0.2 * funnel
        );
        const fade = Math.min(1, share * 6, (1 - share) * 6);
        const visible = open.current[receptor] === true;
        dummy.scale.setScalar(visible ? SIZE.sodium * fade + 0.0001 : 0.0001);
        dummy.updateMatrix();
        target.setMatrixAt(index, dummy.matrix);
      });
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[undefined, undefined, SHOWN * PER_RECEPTOR]}
      ref={mesh}
    >
      <sphereGeometry args={[1, 14, 10]} />
      <meshPhysicalMaterial
        clearcoat={0.8}
        color={SYNAPSE_COLORS.sodium}
        emissive={SYNAPSE_COLORS.sodium}
        emissiveIntensity={0.3}
        roughness={0.3}
      />
    </instancedMesh>
  );
}
