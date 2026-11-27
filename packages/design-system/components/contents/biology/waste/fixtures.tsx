import { createPrintedLabelTexture } from "@repo/design-system/components/contents/biology/fixtures";
import {
  AUTOCLAVE,
  BOTTLE,
  CONTAINER,
  FILL_LIMIT,
  FUNNEL,
  GLASS_BOX,
  SHARPS,
  SINK,
  TRAY,
} from "@repo/design-system/components/contents/biology/waste/station";
import { liquidMeniscus } from "@repo/design-system/components/contents/chemistry/glassware";
import { Turn } from "@repo/design-system/components/three/form/part";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";

/** Undermount laboratory sink with swan-neck chrome tap. */
export function SinkModel({ running }: { readonly running: boolean }) {
  const [x, , z] = SINK.at;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, -SINK.depth / 2 + 0.002, 0]} receiveShadow>
        <boxGeometry args={[SINK.length, SINK.depth, SINK.width]} />
        <meshStandardMaterial color={LABORATORY_COLORS.sink} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.003, 0]}>
        <boxGeometry args={[SINK.length + 0.02, 0.006, SINK.width + 0.02]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.steel}
          metalness={0.5}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position={[-0.08, 0.11, -SINK.width / 2 - 0.02]}>
        <cylinderGeometry args={[0.009, 0.012, 0.22, 16]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.chrome}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh
        castShadow
        position={[-0.08, 0.21, -SINK.width / 2 + 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.008, 0.008, 0.11, 16]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.chrome}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      {running && (
        <mesh position={[-0.08, 0.01, -SINK.width / 2 + 0.09]}>
          <cylinderGeometry args={[0.005, 0.006, 0.36, 12]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.water}
            opacity={0.75}
            transparent
          />
        </mesh>
      )}
    </group>
  );
}

const WINCHESTER_PROFILE = [
  [0, 0],
  [BOTTLE.radius * 0.9, 0],
  [BOTTLE.radius, 0.012],
  [BOTTLE.radius, BOTTLE.height * 0.62],
  [BOTTLE.radius * 0.88, BOTTLE.height * 0.74],
  [BOTTLE.radius * 0.42, BOTTLE.height * 0.86],
  [BOTTLE.neck * 1.15, BOTTLE.height * 0.92],
  [BOTTLE.neck * 1.15, BOTTLE.height * 0.97],
  [BOTTLE.neck * 1.38, BOTTLE.height * 0.985],
  [BOTTLE.neck * 1.32, BOTTLE.height],
] as const;

const WINCHESTER_LIQUID = [
  [0, 0.01],
  [BOTTLE.radius * 0.91, 0.01],
  ...liquidMeniscus(BOTTLE.radius * 0.91, BOTTLE.height * 0.46),
  [0.001, BOTTLE.height * 0.46],
] as const;

const FUNNEL_PROFILE = [
  [0.007, -FUNNEL.stem],
  [0.0085, 0.004],
  [FUNNEL.radius, 0.005 + FUNNEL.cone],
  [FUNNEL.radius * 1.04, 0.005 + FUNNEL.cone + 0.004],
  [FUNNEL.radius * 0.96, 0.005 + FUNNEL.cone + 0.004],
  [0.006, 0.004],
  [0.0055, -FUNNEL.stem],
] as const;

const CAP_FLUTES = Arr.range(0, 15);

/** 2.5 L lathed amber borosilicate Winchester chemical waste bottle with funnel, fluted cap, meniscus, and hazard label. */
export function ChemicalBottle() {
  const [x, , z] = BOTTLE.at;
  const labelTex = useMemo(
    () =>
      createPrintedLabelTexture({
        accentColor: LABORATORY_COLORS.fireRed,
        badge: "HAZARDOUS CHEMICAL WASTE",
        subtitle: "ORGANIC SOLVENTS",
        title: "WASTE 2.5 L",
      }),
    []
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  return (
    <group position={[x, 0, z]}>
      {/* Internal spent-solvent liquid with concave meniscus */}
      <mesh>
        <Turn profile={WINCHESTER_LIQUID} />
        <LiquidMaterial color={LABORATORY_COLORS.amberGlass} opacity={0.78} />
      </mesh>
      {/* Heavy amber glass base */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry
          args={[BOTTLE.radius * 0.94, BOTTLE.radius * 0.9, 0.012, 32]}
        />
        <meshPhysicalMaterial
          clearcoat={1}
          color={LABORATORY_COLORS.amberGlass}
          opacity={0.86}
          roughness={0.08}
          transparent
        />
      </mesh>
      {/* Lathed amber borosilicate Winchester body */}
      <mesh castShadow renderOrder={2}>
        <Turn profile={WINCHESTER_PROFILE} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={LABORATORY_COLORS.amberGlass}
          depthWrite={false}
          ior={1.473}
          metalness={0}
          opacity={0.62}
          roughness={0.06}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Crisp wrapped chemical-waste hazard label */}
      {labelTex === null ? null : (
        <mesh
          position={[0, BOTTLE.height * 0.34, 0]}
          rotation={[0, -Math.PI * 0.45, 0]}
        >
          <cylinderGeometry
            args={[
              BOTTLE.radius + 0.0012,
              BOTTLE.radius + 0.0012,
              BOTTLE.height * 0.36,
              28,
              1,
              true,
              0,
              Math.PI * 0.9,
            ]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.82}
          />
        </mesh>
      )}
      {/* Molded polypropylene funnel seated in the bottle neck */}
      <mesh castShadow position={[0, BOTTLE.height, 0]}>
        <Turn profile={FUNNEL_PROFILE} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={LABORATORY_COLORS.polystyrene}
          roughness={0.28}
          side={DoubleSide}
        />
      </mesh>
      {/* Fluted GL45 screw cap resting beside the Winchester bottle while funnel is in use */}
      <group position={[BOTTLE.radius + 0.028, 0.013, 0.032]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.019, 0.019, 0.024, 24]} />
          <meshStandardMaterial
            color={BENCH_COLORS.bottleCap}
            roughness={0.54}
          />
        </mesh>
        <mesh position={[0, -0.012, 0]}>
          <cylinderGeometry args={[0.0205, 0.0205, 0.004, 24]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.fireRed}
            roughness={0.48}
          />
        </mesh>
        {Arr.map(CAP_FLUTES, (idx) => {
          const angle = (idx / CAP_FLUTES.length) * Math.PI * 2;
          return (
            <mesh
              key={idx}
              position={[Math.cos(angle) * 0.0192, 0, Math.sin(angle) * 0.0192]}
            >
              <cylinderGeometry args={[0.0011, 0.0011, 0.021, 6]} />
              <meshStandardMaterial
                color={BENCH_COLORS.bottleCapRib}
                roughness={0.62}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Yellow 2.5 L sharps container with lid aperture and 75% fill line. */
export function SharpsBin() {
  const [x, , z] = SHARPS.at;
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, SHARPS.height / 2, 0]}>
        <boxGeometry args={[SHARPS.width, SHARPS.height, SHARPS.depth]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.sharpsYellow}
          roughness={0.45}
        />
      </mesh>
      <mesh
        position={[0, SHARPS.height * FILL_LIMIT, SHARPS.depth / 2 + 0.001]}
      >
        <boxGeometry args={[SHARPS.width * 0.85, 0.004, 0.002]} />
        <meshStandardMaterial color={LABORATORY_COLORS.fireRed} />
      </mesh>
      <mesh position={[0, SHARPS.height + 0.002, 0]}>
        <boxGeometry args={[SHARPS.aperture[0], 0.004, SHARPS.aperture[1]]} />
        <meshStandardMaterial color={LABORATORY_COLORS.carbonBand} />
      </mesh>
    </group>
  );
}

/** Corrugated broken glass disposal box on the back bench. */
export function GlassBoxModel() {
  const [x, , z] = GLASS_BOX.at;
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, GLASS_BOX.height / 2, 0]}>
        <boxGeometry
          args={[GLASS_BOX.side, GLASS_BOX.height, GLASS_BOX.side]}
        />
        <meshStandardMaterial
          color={LABORATORY_COLORS.cardboard}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, GLASS_BOX.height + 0.002, 0]}>
        <boxGeometry
          args={[GLASS_BOX.side * 0.6, 0.004, GLASS_BOX.side * 0.45]}
        />
        <meshStandardMaterial color={LABORATORY_COLORS.worktop} />
      </mesh>
    </group>
  );
}

/** Benchtop steam autoclave with lifting lid, pressure gauge, venting steam and inner basket. */
export function AutoclaveModel({
  angle,
  container,
  lid,
  venting,
}: {
  readonly angle: number;
  readonly container: readonly [number, number, number];
  readonly lid: number;
  readonly venting: boolean;
}) {
  const [ax, , az] = AUTOCLAVE.at;
  return (
    <group>
      <group position={[ax, 0, az]}>
        <mesh castShadow position={[0, AUTOCLAVE.base / 2, 0]}>
          <cylinderGeometry
            args={[
              AUTOCLAVE.bore + 0.014,
              AUTOCLAVE.bore + 0.018,
              AUTOCLAVE.base,
              28,
            ]}
          />
          <meshStandardMaterial
            color={LABORATORY_COLORS.plinth}
            roughness={0.5}
          />
        </mesh>
        <mesh
          castShadow
          position={[
            0,
            AUTOCLAVE.base + (AUTOCLAVE.rim - AUTOCLAVE.base) / 2,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              AUTOCLAVE.bore + 0.01,
              AUTOCLAVE.bore + 0.01,
              AUTOCLAVE.rim - AUTOCLAVE.base,
              28,
            ]}
          />
          <meshStandardMaterial
            color={LABORATORY_COLORS.autoclaveSteel}
            metalness={0.55}
            roughness={0.3}
          />
        </mesh>
        <group position={[0, AUTOCLAVE.rim + lid, 0]}>
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry
              args={[AUTOCLAVE.bore + 0.016, AUTOCLAVE.bore + 0.016, 0.04, 28]}
            />
            <meshStandardMaterial
              color={LABORATORY_COLORS.steel}
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
          <group position={[0, 0.065, AUTOCLAVE.bore * 0.55]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.012, 20]} />
              <meshStandardMaterial color={LABORATORY_COLORS.paper} />
            </mesh>
            <group position={[0, 0, 0.008]} rotation={[0, 0, -angle]}>
              <mesh position={[0, 0.009, 0]}>
                <boxGeometry args={[0.003, 0.018, 0.002]} />
                <meshStandardMaterial color={LABORATORY_COLORS.fireRed} />
              </mesh>
            </group>
          </group>
          {venting && (
            <mesh position={[0.04, 0.09, 0]}>
              <coneGeometry args={[0.032, 0.12, 16]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.steam}
                opacity={0.55}
                transparent
              />
            </mesh>
          )}
        </group>
      </group>
      <group position={container}>
        <mesh castShadow position={[0, CONTAINER.depth / 2, 0]}>
          <cylinderGeometry
            args={[
              CONTAINER.radius,
              CONTAINER.radius * 0.94,
              CONTAINER.depth,
              24,
            ]}
          />
          <meshStandardMaterial
            color={LABORATORY_COLORS.biohazardOrange}
            opacity={0.88}
            roughness={0.5}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

/** Shallow bench tray holding unsorted waste items. */
export function TrayModel() {
  const [x, , z] = TRAY.at;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, TRAY.floor / 2, 0]} receiveShadow>
        <boxGeometry args={[TRAY.width, TRAY.floor, TRAY.depth]} />
        <meshStandardMaterial color={LABORATORY_COLORS.steel} roughness={0.4} />
      </mesh>
      <mesh position={[0, TRAY.height / 2, -TRAY.depth / 2]}>
        <boxGeometry args={[TRAY.width, TRAY.height, 0.006]} />
        <meshStandardMaterial color={LABORATORY_COLORS.steel} roughness={0.4} />
      </mesh>
      <mesh position={[0, TRAY.height / 2, TRAY.depth / 2]}>
        <boxGeometry args={[TRAY.width, TRAY.height, 0.006]} />
        <meshStandardMaterial color={LABORATORY_COLORS.steel} roughness={0.4} />
      </mesh>
    </group>
  );
}
