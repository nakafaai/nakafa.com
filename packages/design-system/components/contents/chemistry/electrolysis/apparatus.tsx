import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Path } from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import {
  BATTERY_Y,
  ELECTRODE_TOP,
  pointAlong,
  TERMINAL_OFFSET,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import type { ElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import {
  createBeakerMarkingsTexture,
  latheProfile,
} from "@repo/design-system/components/contents/chemistry/glassware";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { CatmullRomCurve3, Vector3 } from "three";

/** The beaker's inner radius and height. */
export const BEAKER_RADIUS = 0.42;
const BEAKER_HEIGHT = 0.95;

/** How high the electrolyte stands in the beaker. */
export const LIQUID_HEIGHT = 0.62;

/** The height of an electrode's bottom, clear of the beaker's floor. */
export const ELECTRODE_BOTTOM = 0.12;

/** An electrode plate's thickness and width. */
export const ELECTRODE_THICKNESS = 0.07;
export const ELECTRODE_WIDTH = 0.14;

/** The dots that stand for electrons on each lead, and how fast they move. */
const ELECTRONS_PER_LEAD = 6;
const ELECTRON_SPEED = 0.16;

/** The bubbles a gas electrode gives off. */
const BUBBLES = 6;

/** How thick the beaker's wall and its base are drawn, in scene units. */
const WALL = 0.014;
const BASE = 0.03;

/**
 * A Griffin beaker's wall in section, turned on the lathe: a thick base, a
 * rounded heel, a straight wall, a rim that flares and rolls over, and the
 * inner wall back down, so the glass has a real thickness to catch the light.
 */
const BEAKER_PROFILE = latheProfile([
  [0.001, 0],
  [BEAKER_RADIUS - 0.03, 0],
  [BEAKER_RADIUS + WALL - 0.008, 0.008],
  [BEAKER_RADIUS + WALL, 0.035],
  [BEAKER_RADIUS + WALL, BEAKER_HEIGHT - 0.05],
  [BEAKER_RADIUS + WALL + 0.012, BEAKER_HEIGHT - 0.02],
  [BEAKER_RADIUS + WALL + 0.03, BEAKER_HEIGHT - 0.003],
  [BEAKER_RADIUS + WALL + 0.03, BEAKER_HEIGHT + 0.006],
  [BEAKER_RADIUS + WALL + 0.018, BEAKER_HEIGHT + 0.008],
  [BEAKER_RADIUS, BEAKER_HEIGHT - 0.04],
  [BEAKER_RADIUS, BASE + 0.025],
  [BEAKER_RADIUS - 0.025, BASE],
  [0.001, BASE],
]);

/**
 * A borosilicate Griffin beaker with a pouring spout and its printed scale,
 * open at the top, standing on the bench at y = 0.
 */
export function Beaker({ colors }: { readonly colors: ElectrolysisColors }) {
  const markings = useMemo(createBeakerMarkingsTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[BEAKER_PROFILE, 96]} />
        <GlassMaterial color={colors.glass} opacity={0.26} />
      </mesh>
      <mesh
        position={[0, BEAKER_HEIGHT - 0.012, BEAKER_RADIUS + WALL + 0.024]}
        rotation={[0.42, 0, 0]}
        scale={[0.8, 0.6, 1.15]}
      >
        <cylinderGeometry
          args={[0.045, 0.07, 0.1, 24, 1, true, -1.2 - Math.PI / 2, 2.4]}
        />
        <GlassMaterial color={colors.glass} opacity={0.5} />
      </mesh>
      {markings === null ? null : (
        <mesh
          position={[0, BEAKER_HEIGHT * 0.5, 0]}
          renderOrder={3}
          rotation={[0, -Math.PI * 0.72, 0]}
        >
          <cylinderGeometry
            args={[
              BEAKER_RADIUS + WALL + 0.003,
              BEAKER_RADIUS + WALL + 0.003,
              BEAKER_HEIGHT * 0.78,
              64,
              1,
              true,
            ]}
          />
          <meshBasicMaterial
            depthWrite={false}
            map={markings}
            opacity={0.9}
            transparent
          />
        </mesh>
      )}
    </group>
  );
}

/** Bubbles rising from an electrode's submerged face to the surface. */
export function Bubbles({ color }: { readonly color: string }) {
  const group = useRef<Group>(null);

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (bubble, index) => {
      const progress = (clock.elapsedTime * 0.35 + index / BUBBLES) % 1;
      bubble.position.set(
        (index % 2 === 0 ? 1 : -1) * (ELECTRODE_THICKNESS / 2 + 0.025),
        ELECTRODE_BOTTOM +
          0.04 +
          progress * (LIQUID_HEIGHT - ELECTRODE_BOTTOM - 0.06),
        ((index % 3) - 1) * 0.04
      );
    });
  });

  return (
    <CameraBounds exclude>
      <group ref={group}>
        {Arr.makeBy(BUBBLES, (index) => (
          <mesh key={String(index)}>
            <sphereGeometry args={[0.018, 12, 8]} />
            <meshStandardMaterial
              color={color}
              opacity={0.7}
              roughness={0.1}
              transparent
            />
          </mesh>
        ))}
      </group>
    </CameraBounds>
  );
}

/**
 * The low-voltage DC power pack a school lab runs electrolysis from: a
 * light grey case with a dark front panel and a voltage knob, and its two
 * 4 mm terminals on top, red for positive on the left and black for negative.
 */
export function Battery({
  colors,
  label,
}: {
  readonly colors: ElectrolysisColors;
  readonly label: string;
}) {
  return (
    <group position={[0, BATTERY_Y, 0]}>
      <RoundedBox
        args={[TERMINAL_OFFSET * 2 + 0.34, 0.3, 0.26]}
        castShadow
        position={[0, -0.18, 0]}
        radius={0.035}
        smoothness={4}
      >
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={BENCH_COLORS.hotplateBody}
          roughness={0.5}
        />
      </RoundedBox>
      <mesh position={[0, -0.18, 0.131]}>
        <planeGeometry args={[TERMINAL_OFFSET * 2 + 0.2, 0.2]} />
        <meshStandardMaterial color={BENCH_COLORS.epoxy} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.18, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.04, 32]} />
        <meshStandardMaterial color={BENCH_COLORS.bottleCap} roughness={0.45} />
      </mesh>
      {Arr.map(
        [
          { color: BENCH_COLORS.leadRed, x: -TERMINAL_OFFSET },
          { color: BENCH_COLORS.leadBlack, x: TERMINAL_OFFSET },
        ] as const,
        (terminal) => (
          <mesh castShadow key={terminal.x} position={[terminal.x, -0.02, 0]}>
            <cylinderGeometry args={[0.03, 0.034, 0.07, 24]} />
            <meshPhysicalMaterial
              clearcoat={0.4}
              color={terminal.color}
              roughness={0.4}
            />
          </mesh>
        )
      )}
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[-TERMINAL_OFFSET - 0.1, 0.02, 0.08]}
      >
        <InlineMath math="+" />
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[TERMINAL_OFFSET + 0.1, 0.02, 0.08]}
      >
        <InlineMath math="-" />
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[0, 0.12, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/**
 * One insulated test lead in its colour, run along its path with soft bends,
 * a chrome crocodile clip where it grips an electrode, and the electrons
 * moving along it.
 */
export function Lead({
  colors,
  lead,
  sheath,
}: {
  readonly colors: ElectrolysisColors;
  readonly lead: Path;
  readonly sheath: string;
}) {
  const group = useRef<Group>(null);
  const cable = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(lead, ([x, y, z]) => new Vector3(x, y, z)),
        false,
        "catmullrom",
        0.05
      ),
    [lead]
  );
  const clips = Arr.filter(
    [Arr.head(lead), Arr.last(lead)],
    (end) => Option.isSome(end) && end.value[1] === ELECTRODE_TOP
  );

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (electron, index) => {
      const [x, y, z] = pointAlong(
        lead,
        clock.elapsedTime * ELECTRON_SPEED + index / ELECTRONS_PER_LEAD
      );
      electron.position.set(x, y, z);
    });
  });

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[cable, 96, 0.016, 12, false]} />
        <meshPhysicalMaterial clearcoat={0.3} color={sheath} roughness={0.45} />
      </mesh>
      {Arr.map(Arr.getSomes(clips), ([x, y, z]) => (
        <RoundedBox
          args={[0.06, 0.08, 0.1]}
          castShadow
          key={`${x}-${y}`}
          position={[x, y + 0.02, z]}
          radius={0.012}
          smoothness={2}
        >
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.25} />
        </RoundedBox>
      ))}
      <CameraBounds exclude>
        <group ref={group}>
          {Arr.makeBy(ELECTRONS_PER_LEAD, (index) => (
            <mesh key={String(index)}>
              <sphereGeometry args={[0.022, 12, 8]} />
              <meshStandardMaterial color={colors.electron} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </CameraBounds>
    </group>
  );
}
