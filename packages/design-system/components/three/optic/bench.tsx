import { railSheets } from "@repo/design-system/components/three/optic/scale";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Shape } from "three";

/** How tall the rail stands on the benchtop, and how wide its foot and its top are. */
const RAIL_TALL = 0.15;
const RAIL_FOOT = 0.2;
const RAIL_TOP = 0.105;

/** Where the sloped front face of the rail starts and ends, which carries the scale. */
const SLOPE_LOW = 0.028;
const SLOPE_HIGH = 0.118;

/** The cross-section of the rail: a wide foot, two sloped flanks and a flat top with a slot down its middle. */
function railSection() {
  const section = new Shape();
  section.moveTo(-RAIL_FOOT, 0);
  section.lineTo(RAIL_FOOT, 0);
  section.lineTo(RAIL_FOOT, SLOPE_LOW);
  section.lineTo(RAIL_TOP, SLOPE_HIGH);
  section.lineTo(RAIL_TOP, RAIL_TALL);
  section.lineTo(0.022, RAIL_TALL);
  section.lineTo(0.022, RAIL_TALL - 0.03);
  section.lineTo(-0.022, RAIL_TALL - 0.03);
  section.lineTo(-0.022, RAIL_TALL);
  section.lineTo(-RAIL_TOP, RAIL_TALL);
  section.lineTo(-RAIL_TOP, SLOPE_HIGH);
  section.lineTo(-RAIL_FOOT, SLOPE_LOW);
  section.closePath();
  return section;
}

/** The cross-section of a carrier's saddle, which sits over the rail's top and grips its flanks. */
function saddleSection() {
  const section = new Shape();
  const lip = RAIL_TOP + 0.045;
  section.moveTo(-lip, SLOPE_HIGH - 0.03);
  section.lineTo(-lip + 0.03, SLOPE_HIGH - 0.03);
  section.lineTo(-RAIL_TOP - 0.004, RAIL_TALL + 0.002);
  section.lineTo(RAIL_TOP + 0.004, RAIL_TALL + 0.002);
  section.lineTo(lip - 0.03, SLOPE_HIGH - 0.03);
  section.lineTo(lip, SLOPE_HIGH - 0.03);
  section.lineTo(lip, RAIL_TALL + 0.05);
  section.lineTo(lip - 0.02, RAIL_TALL + 0.07);
  section.lineTo(-lip + 0.02, RAIL_TALL + 0.07);
  section.lineTo(-lip, RAIL_TALL + 0.05);
  section.closePath();
  return section;
}

/** A levelling foot across one end of the rail: a cast bar on two knurled screws with rubber pads. */
function Foot({ at }: { readonly at: number }) {
  return (
    <group position={[at, 0, 0]}>
      <mesh castShadow position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[0.12, 0.05, 0.66]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.anodised}
          metalness={1}
          repeat={[1, 3]}
          roughness={0.5}
          surface="cast"
        />
      </mesh>
      {Arr.map([-0.28, 0.28], (side) => (
        <group key={side} position={[0, 0, side]}>
          <mesh castShadow position={[0, 0.085, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.03, 40]} />
            <SurfaceMaterial
              color={INSTRUMENT_COLORS.aluminium}
              metalness={1}
              repeat={[10, 1]}
              roughness={0.3}
              surface="knurl"
            />
          </mesh>
          <mesh castShadow position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.03, 0.034, 0.024, 28]} />
            <SurfaceMaterial
              color={INSTRUMENT_COLORS.graphite}
              roughness={0.9}
              surface="rubber"
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * An optical bench: a black anodised aluminium rail along x, `length` long
 * and centred on the origin, on a levelling foot at each end, with a
 * centimetre scale engraved along its sloped front face. One centimetre of
 * the lab is `unit` scene units, so the scale reads the lab's own distances.
 *
 * @param length - How long the rail is, in scene units
 * @param unit - How many scene units one centimetre of the lab takes
 */
export function Rail({
  length,
  unit,
}: {
  readonly length: number;
  readonly unit: number;
}) {
  const section = useMemo(railSection, []);
  const format = usePrintNumber();
  const slope = Math.atan2(RAIL_FOOT - RAIL_TOP, SLOPE_HIGH - SLOPE_LOW);
  const wide = Math.hypot(RAIL_FOOT - RAIL_TOP, SLOPE_HIGH - SLOPE_LOW);
  const scale = useMemo(
    () =>
      railSheets(
        { long: length - 0.04, tall: wide * 0.78, unit },
        INSTRUMENT_COLORS.paper,
        format
      ),
    [format, length, unit, wide]
  );

  return (
    <group>
      <group position={[0, 0.07, 0]}>
        <mesh
          castShadow
          position={[-length / 2, 0, 0]}
          receiveShadow
          rotation={[0, Math.PI / 2, 0]}
        >
          <extrudeGeometry
            args={[
              section,
              {
                bevelEnabled: true,
                bevelSegments: 2,
                bevelSize: 0.004,
                bevelThickness: 0.004,
                depth: length,
              },
            ]}
          />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.anodised}
            metalness={1}
            repeat={[2, length * 2]}
            roughness={0.42}
            surface="brushed"
          />
        </mesh>
        <group
          position={[
            0.02 - length / 2,
            (SLOPE_LOW + SLOPE_HIGH) / 2 + 0.004 * Math.sin(slope),
            (RAIL_FOOT + RAIL_TOP) / 2 + 0.004 * Math.cos(slope),
          ]}
          rotation={[slope - Math.PI / 2, 0, 0]}
        >
          {Arr.map(scale, (piece) => (
            <group key={piece.at} position={[piece.at, 0, 0]}>
              <PrintFace sheet={piece.sheet} stock="engraving" />
            </group>
          ))}
        </group>
      </group>
      <Foot at={-length / 2 + 0.16} />
      <Foot at={length / 2 - 0.16} />
    </group>
  );
}

/** How high a rail's top stands above the benchtop, which every carrier rides on. */
const RIDE = 0.07 + RAIL_TALL;

/**
 * A carrier that rides the rail at `at` along it: a saddle clamped over the
 * rail with a knurled thumbscrew, a post holder with its own locking screw,
 * and a steel post that lifts whatever the carrier holds to `height` above
 * the benchtop. The held part is drawn at the top of the post, at the origin
 * of the carrier's children.
 *
 * @param at - Where along the rail the carrier stands, in scene units
 * @param height - How high above the benchtop the held part's middle stands
 * @param drop - How far below its middle the held part's mount reaches
 */
export function Rider({
  at,
  children,
  drop,
  height,
}: {
  readonly at: number;
  readonly children: ReactNode;
  readonly drop: number;
  readonly height: number;
}) {
  const section = useMemo(saddleSection, []);
  const post = Math.max(height - drop - RIDE - 0.07, 0.02);

  return (
    <group position={[at, 0, 0]}>
      <mesh
        castShadow
        position={[-0.09, 0.07, 0]}
        receiveShadow
        rotation={[0, Math.PI / 2, 0]}
      >
        <extrudeGeometry
          args={[
            section,
            {
              bevelEnabled: true,
              bevelSegments: 2,
              bevelSize: 0.005,
              bevelThickness: 0.005,
              depth: 0.18,
            },
          ]}
        />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.enamel}
          metalness={1}
          repeat={[1, 1]}
          roughness={0.4}
          surface="brushed"
        />
      </mesh>
      <group position={[0, 0.07 + SLOPE_HIGH, RAIL_TOP + 0.07]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.036, 0.036, 0.04, 36]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[9, 1]}
            roughness={0.28}
            surface="knurl"
          />
        </mesh>
        <mesh position={[0, 0, -0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.05, 14]} />
          <MetalMaterial color={INSTRUMENT_COLORS.silver} roughness={0.3} />
        </mesh>
      </group>
      <group position={[0, RIDE + 0.07, 0]}>
        <mesh castShadow position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.034, 0.04, 0.14, 32]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.anodised}
            metalness={1}
            repeat={[3, 1]}
            roughness={0.36}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow position={[0, 0.142, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.012, 32]} />
          <MetalMaterial color={INSTRUMENT_COLORS.silver} roughness={0.26} />
        </mesh>
        <mesh
          castShadow
          position={[0, 0.09, 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.019, 0.019, 0.034, 28]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[6, 1]}
            roughness={0.28}
            surface="knurl"
          />
        </mesh>
        <mesh castShadow position={[0, post / 2, 0]}>
          <cylinderGeometry args={[0.017, 0.017, post, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.silver} roughness={0.2} />
        </mesh>
      </group>
      <group position={[0, height, 0]}>{children}</group>
    </group>
  );
}

/**
 * A white matt screen in a thin metal frame, `wide` by `tall`, standing
 * across the bench so its face looks back along the rail toward -x. A real
 * image is caught on it, so whatever the lab draws as that image goes in its
 * children, which lie in the plane of the face.
 *
 * @param wide - The width of the card, across the bench
 * @param tall - The height of the card
 */
export function Screen({
  children,
  tall,
  wide,
}: {
  readonly children?: ReactNode;
  readonly tall: number;
  readonly wide: number;
}) {
  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[wide, tall, 0.012]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.paper}
          repeat={[wide * 6, tall * 6]}
          roughness={0.95}
          surface="tissue"
        />
      </mesh>
      {Arr.map(
        [
          {
            at: [0, tall / 2 + 0.008, 0],
            key: "top",
            size: [wide + 0.032, 0.016, 0.03],
          },
          {
            at: [0, -tall / 2 - 0.008, 0],
            key: "bottom",
            size: [wide + 0.032, 0.016, 0.03],
          },
          {
            at: [wide / 2 + 0.008, 0, 0],
            key: "right",
            size: [0.016, tall, 0.03],
          },
          {
            at: [-wide / 2 - 0.008, 0, 0],
            key: "left",
            size: [0.016, tall, 0.03],
          },
        ] as const,
        (edge) => (
          <mesh castShadow key={edge.key} position={edge.at}>
            <boxGeometry args={edge.size} />
            <SurfaceMaterial
              color={INSTRUMENT_COLORS.anodised}
              metalness={1}
              repeat={[1, 4]}
              roughness={0.4}
              surface="brushed"
            />
          </mesh>
        )
      )}
      <group position={[0, 0, 0.0075]}>{children}</group>
    </group>
  );
}

/**
 * The blackout board of an optics bench: a panel `wide` by `tall` covered in
 * black felt, in a wooden frame on two feet, standing `back` behind the
 * rail. A beam shows against it as it does in a darkened room.
 *
 * @param wide - The width of the panel, along the bench
 * @param tall - The height of the panel
 * @param back - How far behind the middle of the bench the panel stands
 */
export function Backboard({
  back,
  tall,
  wide,
}: {
  readonly back: number;
  readonly tall: number;
  readonly wide: number;
}) {
  return (
    <group position={[0, 0, -back]}>
      <mesh castShadow position={[0, tall / 2 + 0.06, 0]} receiveShadow>
        <boxGeometry args={[wide, tall, 0.03]} />
        <SurfaceMaterial
          bump={1}
          color={INSTRUMENT_COLORS.graphite}
          repeat={[wide * 5, tall * 5]}
          roughness={1}
          surface="cloth"
        />
      </mesh>
      {Arr.map(
        [
          {
            at: [0, tall + 0.08, 0],
            key: "top",
            size: [wide + 0.08, 0.04, 0.06],
          },
          { at: [0, 0.04, 0], key: "bottom", size: [wide + 0.08, 0.04, 0.06] },
          {
            at: [wide / 2 + 0.02, tall / 2 + 0.06, 0],
            key: "right",
            size: [0.04, tall, 0.06],
          },
          {
            at: [-wide / 2 - 0.02, tall / 2 + 0.06, 0],
            key: "left",
            size: [0.04, tall, 0.06],
          },
          {
            at: [wide / 2 - 0.3, 0.02, 0],
            key: "rightFoot",
            size: [0.08, 0.04, 0.5],
          },
          {
            at: [-wide / 2 + 0.3, 0.02, 0],
            key: "leftFoot",
            size: [0.08, 0.04, 0.5],
          },
        ] as const,
        (beam) => (
          <mesh castShadow key={beam.key} position={beam.at} receiveShadow>
            <boxGeometry args={beam.size} />
            <SurfaceMaterial
              coat={0.3}
              color={INSTRUMENT_COLORS.oak}
              repeat={[1, 3]}
              roughness={0.6}
              surface="wood"
            />
          </mesh>
        )
      )}
    </group>
  );
}
