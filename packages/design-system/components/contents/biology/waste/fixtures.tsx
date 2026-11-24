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
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";

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

/** 2.5 L amber Winchester chemical waste bottle with a funnel in its neck. */
export function ChemicalBottle() {
  const [x, , z] = BOTTLE.at;
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, (BOTTLE.height - 0.05) / 2, 0]}>
        <cylinderGeometry
          args={[BOTTLE.radius, BOTTLE.radius, BOTTLE.height - 0.05, 24]}
        />
        <meshPhysicalMaterial
          color={LABORATORY_COLORS.amberGlass}
          opacity={0.85}
          roughness={0.2}
          transparent
        />
      </mesh>
      <mesh castShadow position={[0, BOTTLE.height - 0.025, 0]}>
        <cylinderGeometry
          args={[BOTTLE.neck, BOTTLE.radius * 0.65, 0.05, 20]}
        />
        <meshPhysicalMaterial
          color={LABORATORY_COLORS.amberGlass}
          opacity={0.85}
          roughness={0.2}
          transparent
        />
      </mesh>
      <mesh
        castShadow
        position={[0, BOTTLE.height + 0.005 + FUNNEL.cone / 2, 0]}
      >
        <cylinderGeometry args={[FUNNEL.radius, 0.008, FUNNEL.cone, 20]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.polystyrene}
          roughness={0.3}
        />
      </mesh>
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
