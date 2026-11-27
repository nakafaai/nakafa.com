import { useFrame } from "@react-three/fiber";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Shine } from "@repo/design-system/components/three/matter/shine";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { Array as Arr, HashSet, Option, Order } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Mesh, MeshPhysicalMaterial, Vector3 } from "three";

/** Seconds one fission plays over. */
const PLAY_SECONDS = 6;
/** The moments of the fission, as shares of its play: when the neutron arrives, and when the nucleus tears in two. */
const ARRIVE = 0.26;
const TEAR = 0.5;
/** How many nucleons the nucleus is drawn with, how big one is, and how big the nucleus is. */
const NUCLEONS = 96;
const SIZE = 0.115;
const BALL = 0.7;
/** The shells the nucleons are packed in: the radius of each, how many it holds, and the first nucleon it holds. */
const SHELLS = [
  { count: 8, first: 0, radius: 0.2 },
  { count: 28, first: 8, radius: 0.4 },
  { count: 60, first: 36, radius: 0.6 },
] as const;
/** The share of the drawn nucleons that are protons, as in uranium, and where the nucleus divides into its heavier and lighter fragment. */
const PROTONS = 92 / 235;
const DIVIDE = 0.1;
/** How far the heavier and the lighter fragment have flown by the end, and how far a freed neutron has. */
const HEAVY = -1.5;
const LIGHT = 2.1;
const FLIGHT = 3.4;

/** The nested shells of the flash, from its bright heart to its faint edge, so its light falls off softly. */
const GLOW_SHELLS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2] as const;

/** The smooth start and stop of a move that runs from 0 to 1. */
function ease(share: number) {
  const within = Math.min(1, Math.max(0, share));
  return within * within * (3 - 2 * within);
}

/**
 * One fission, nucleon by nucleon: a slow neutron drifts into a heavy
 * nucleus of red protons and grey neutrons, the nucleus stretches, necks and
 * tears into a heavier and a lighter fragment that fly apart, and `released`
 * fast neutrons leave with a flash. Before the card plays it shows the
 * outcome; playing runs the fission from the neutron's approach.
 */
export function FissionScene({ released }: { readonly released: number }) {
  const { advance } = useTimeline(0, PLAY_SECONDS);
  const cluster = useRef<Group>(null);
  const incoming = useRef<Mesh>(null);
  const flash = useRef<Group>(null);
  const flare = useRef(0);
  const nucleons = useMemo(
    () =>
      Arr.makeBy(NUCLEONS, (index) => {
        // Three shells fill the ball, each spread evenly by a golden-angle spiral.
        const shell = Option.getOrElse(
          Arr.findLast(SHELLS, (candidate) => index >= candidate.first),
          () => SHELLS[0]
        );
        const place = index - shell.first;
        const tilt = Math.acos(1 - (2 * (place + 0.5)) / shell.count);
        const turn = place * Math.PI * (3 - Math.sqrt(5)) + shell.radius * 9;
        const home = new Vector3(
          Math.sin(tilt) * Math.cos(turn),
          Math.cos(tilt),
          Math.sin(tilt) * Math.sin(turn)
        ).multiplyScalar(shell.radius);
        const flight = new Vector3(
          hashUnit(index, 61) - 0.3,
          hashUnit(index, 62) * 2 - 1,
          hashUnit(index, 63) * 2 - 1
        ).normalize();
        return {
          flight,
          home,
          key: index,
          light: home.x > DIVIDE,
          phase: hashUnit(index, 64) * Math.PI * 2,
          proton: hashUnit(index, 65) < PROTONS,
        };
      }),
    []
  );
  /** The nucleons nearest the neck are the ones that leave as free neutrons. */
  const free = useMemo(() => {
    const neutrons = Arr.filter(nucleons, (nucleon) => !nucleon.proton);
    const nearest = Arr.sortWith(
      neutrons,
      (nucleon) => Math.abs(nucleon.home.x - DIVIDE) + nucleon.home.length(),
      Order.Number
    );
    return HashSet.fromIterable(
      Arr.map(Arr.take(nearest, released), (item) => item.key)
    );
  }, [nucleons, released]);

  useFrame((state, delta) => {
    const share = advance(delta) / PLAY_SECONDS;
    const stretch = ease((share - ARRIVE) / (TEAR - ARRIVE));
    const apart = ease((share - TEAR) / (1 - TEAR));
    const quiver = share > ARRIVE && share < 1 ? 0.012 : 0;
    Arr.forEach(cluster.current?.children ?? [], (mesh, index) => {
      const nucleon = nucleons[index];
      if (nucleon === undefined) {
        return;
      }
      const side = nucleon.light ? 1 : -1;
      const shake =
        Math.sin(state.clock.elapsedTime * 9 + nucleon.phase) * quiver;
      if (HashSet.has(free, nucleon.key) && apart > 0) {
        mesh.position
          .copy(nucleon.home)
          .addScaledVector(nucleon.flight, apart * FLIGHT);
        return;
      }
      // The nucleus stretches along its axis and thins across it, then each half draws back into a ball as it leaves.
      const long = 1 + 0.45 * stretch * (1 - apart);
      const thin = 1 - 0.16 * stretch * (1 - apart);
      const centre = nucleon.light ? LIGHT : HEAVY;
      mesh.position.set(
        nucleon.home.x * long + side * 0.24 * stretch + centre * apart + shake,
        nucleon.home.y * thin + shake,
        nucleon.home.z * thin
      );
    });
    if (incoming.current !== null) {
      const near = ease(share / ARRIVE);
      incoming.current.visible = share < ARRIVE;
      incoming.current.position.set(-3.4 + near * (3.4 - BALL), 0, 0);
    }
    const burst = Math.max(0, 1 - Math.abs(share - TEAR - 0.05) / 0.12);
    flare.current = burst;
    if (flash.current !== null) {
      flash.current.visible = burst > 0.01;
      flash.current.scale.setScalar(0.5 + (1 - burst) * 1.2);
      for (const shell of flash.current.children) {
        if (
          shell instanceof Mesh &&
          shell.material instanceof MeshPhysicalMaterial
        ) {
          shell.material.opacity = burst * 0.12;
        }
      }
    }
  });

  return (
    <group>
      <BenchCamera
        narrow={[0.4, 1.2, 10.5]}
        target={[0.2, 0, 0]}
        wide={[0.4, 0.9, 5.6]}
      />
      <group ref={cluster}>
        {Arr.map(nucleons, (nucleon) => (
          <mesh castShadow key={nucleon.key} position={nucleon.home}>
            <sphereGeometry args={[SIZE, 24, 18]} />
            <Matter
              color={
                nucleon.proton
                  ? APPARATUS_COLORS.proton
                  : APPARATUS_COLORS.neutron
              }
              of="enamel"
            />
          </mesh>
        ))}
      </group>
      <mesh castShadow ref={incoming}>
        <sphereGeometry args={[SIZE, 24, 18]} />
        <Matter color={APPARATUS_COLORS.neutronFree} glow={0.12} of="enamel" />
      </mesh>
      <group>
        <group ref={flash} visible={false}>
          {Arr.map(GLOW_SHELLS, (radius) => (
            <mesh key={radius} scale={radius}>
              <sphereGeometry args={[1, 32, 24]} />
              <Matter
                color={APPARATUS_COLORS.fissionFlash}
                glow={0.5}
                of="light"
                opacity={0}
              />
            </mesh>
          ))}
        </group>
        <Shine
          color={APPARATUS_COLORS.fissionFlash}
          glow={0.5}
          level={flare}
          of="light"
        />
      </group>
    </group>
  );
}
