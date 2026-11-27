import { ChromatidArm } from "@repo/design-system/components/contents/biology/chromatin";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/** Homologous bivalent tetrad crossing over at a glowing chiasma with recombinant tips. */
export function CrossingOverView() {
  return (
    <group position={[0, 0.66, 0]}>
      <mesh position={[0, 0, -0.25]}>
        <torusGeometry args={[0.68, 0.012, 12, 64]} />
        <meshPhysicalMaterial
          color={GENETICS_COLORS.spindleFiber}
          emissive={GENETICS_COLORS.spindleFiber}
          emissiveIntensity={0.25}
          opacity={0.32}
          roughness={0.2}
          transparent
        />
      </mesh>

      {/* Maternal homologue (left, rose Giemsa) */}
      <group position={[-0.24, 0.06, 0]}>
        <ChromatidArm
          accentColor={GENETICS_COLORS.maternalRose}
          bandColor={GENETICS_COLORS.maternalDark}
          baseColor={GENETICS_COLORS.maternalLight}
          length={0.34}
          position={[-0.04, 0.02, 0]}
          radius={0.062}
          rotation={[0, 0, 0.22]}
          seed={3}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.maternalRose}
          bandColor={GENETICS_COLORS.maternalDark}
          baseColor={GENETICS_COLORS.maternalLight}
          length={0.44}
          position={[-0.04, -0.02, 0]}
          radius={0.062}
          rotation={[0, 0, Math.PI - 0.16]}
          seed={7}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.maternalRose}
          bandColor={GENETICS_COLORS.maternalDark}
          baseColor={GENETICS_COLORS.maternalLight}
          length={0.34}
          position={[0.04, 0.02, 0]}
          radius={0.062}
          rotation={[0, 0, -0.1]}
          seed={9}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.maternalRose}
          bandColor={GENETICS_COLORS.maternalDark}
          baseColor={GENETICS_COLORS.maternalLight}
          length={0.34}
          position={[0.04, -0.02, 0.02]}
          radius={0.062}
          rotation={[0, 0, Math.PI + 0.52]}
          seed={11}
          showTelomere={false}
        />
        <mesh castShadow scale={[1.15, 0.65, 1]}>
          <sphereGeometry args={[0.068, 20, 16]} />
          <MetalMaterial
            color={GENETICS_COLORS.kinetochoreGold}
            roughness={0.26}
          />
        </mesh>
      </group>

      {/* Paternal homologue (right, cobalt Giemsa) */}
      <group position={[0.24, 0.06, 0]}>
        <ChromatidArm
          accentColor={GENETICS_COLORS.paternalBlue}
          bandColor={GENETICS_COLORS.paternalDark}
          baseColor={GENETICS_COLORS.paternalLight}
          length={0.34}
          position={[0.04, 0.02, 0]}
          radius={0.062}
          rotation={[0, 0, -0.22]}
          seed={13}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.paternalBlue}
          bandColor={GENETICS_COLORS.paternalDark}
          baseColor={GENETICS_COLORS.paternalLight}
          length={0.44}
          position={[0.04, -0.02, 0]}
          radius={0.062}
          rotation={[0, 0, Math.PI + 0.16]}
          seed={17}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.paternalBlue}
          bandColor={GENETICS_COLORS.paternalDark}
          baseColor={GENETICS_COLORS.paternalLight}
          length={0.34}
          position={[-0.04, 0.02, 0]}
          radius={0.062}
          rotation={[0, 0, 0.1]}
          seed={19}
        />
        <ChromatidArm
          accentColor={GENETICS_COLORS.paternalBlue}
          bandColor={GENETICS_COLORS.paternalDark}
          baseColor={GENETICS_COLORS.paternalLight}
          length={0.34}
          position={[-0.04, -0.02, -0.02]}
          radius={0.062}
          rotation={[0, 0, Math.PI - 0.52]}
          seed={21}
          showTelomere={false}
        />
        <mesh castShadow scale={[1.15, 0.65, 1]}>
          <sphereGeometry args={[0.068, 20, 16]} />
          <MetalMaterial
            color={GENETICS_COLORS.kinetochoreGold}
            roughness={0.26}
          />
        </mesh>
      </group>

      {/* Swapped recombinant tips below chiasma */}
      <ChromatidArm
        accentColor={GENETICS_COLORS.paternalBlue}
        bandColor={GENETICS_COLORS.paternalDark}
        baseColor={GENETICS_COLORS.paternalLight}
        length={0.18}
        position={[-0.02, -0.24, -0.02]}
        radius={0.056}
        rotation={[0, 0, Math.PI - 0.32]}
        seed={23}
      />
      <ChromatidArm
        accentColor={GENETICS_COLORS.maternalRose}
        bandColor={GENETICS_COLORS.maternalDark}
        baseColor={GENETICS_COLORS.maternalLight}
        length={0.18}
        position={[0.02, -0.24, 0.02]}
        radius={0.056}
        rotation={[0, 0, Math.PI + 0.32]}
        seed={29}
      />

      {/* Luminous chiasma recombination ring */}
      <group position={[0, -0.2, 0.02]}>
        <mesh>
          <sphereGeometry args={[0.064, 20, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.8}
            color={GENETICS_COLORS.chiasmaGlow}
            emissive={GENETICS_COLORS.chiasmaGlow}
            emissiveIntensity={0.62}
            roughness={0.18}
          />
        </mesh>
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <torusGeometry args={[0.092, 0.01, 10, 32]} />
          <meshPhysicalMaterial
            color={GENETICS_COLORS.chiasmaGlow}
            emissive={GENETICS_COLORS.chiasmaGlow}
            emissiveIntensity={0.75}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Oocyte + flagellated spermatozoon converging toward diploid zygote fusion. */
export function FertilisationView() {
  const flagellumGeo = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0.18, 0, 0),
      new Vector3(0.32, 0.04, 0.03),
      new Vector3(0.46, -0.035, -0.02),
      new Vector3(0.62, 0.025, 0.02),
      new Vector3(0.76, -0.01, 0),
    ]);
    return new TubeGeometry(curve, 32, 0.011, 8, false);
  }, []);

  useEffect(() => () => flagellumGeo.dispose(), [flagellumGeo]);

  return (
    <group position={[0, 0.66, 0]}>
      <group position={[-0.44, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.25, 32, 24]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={BIOLOGY_COLORS.zonaPellucida}
            opacity={0.44}
            roughness={0.22}
            transparent
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.18, 28, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={BIOLOGY_COLORS.oocyteYolk}
            opacity={0.86}
            roughness={0.36}
            transparent
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.082, 20, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={GENETICS_COLORS.maternalRose}
            roughness={0.3}
          />
        </mesh>
        {Arr.makeBy(10, (i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <mesh
              key={`cr-${i}`}
              position={[Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0]}
            >
              <sphereGeometry args={[0.036, 12, 10]} />
              <meshPhysicalMaterial
                clearcoat={0.35}
                color={BIOLOGY_COLORS.coronaCell}
                roughness={0.48}
              />
            </mesh>
          );
        })}
      </group>

      <group position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.115, 24, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.82}
            color={GENETICS_COLORS.gameteCyan}
            emissive={GENETICS_COLORS.gameteCyan}
            emissiveIntensity={0.38}
            opacity={0.78}
            roughness={0.18}
            transparent
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.2, 0]}>
          <torusGeometry args={[0.155, 0.008, 10, 40]} />
          <meshPhysicalMaterial
            color={GENETICS_COLORS.spindleFiber}
            emissive={GENETICS_COLORS.spindleFiber}
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
      </group>

      <group position={[0.38, 0, 0]}>
        <mesh
          castShadow
          position={[-0.085, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.78, 1.15, 0.72]}
        >
          <sphereGeometry
            args={[0.072, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]}
          />
          <meshPhysicalMaterial
            clearcoat={0.8}
            color={BIOLOGY_COLORS.acrosomeGold}
            roughness={0.24}
          />
        </mesh>
        <mesh castShadow position={[0, 0, 0]} scale={[1.25, 0.84, 0.78]}>
          <sphereGeometry args={[0.076, 22, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.74}
            color={GENETICS_COLORS.paternalBlue}
            roughness={0.28}
          />
        </mesh>
        <mesh castShadow position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.026, 0.022, 0.13, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={BIOLOGY_COLORS.midpieceCopper}
            roughness={0.32}
          />
        </mesh>
        <mesh geometry={flagellumGeo}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={BIOLOGY_COLORS.flagellumIvory}
            roughness={0.34}
          />
        </mesh>
      </group>
    </group>
  );
}

function CentriolePole({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  const triplets = useMemo(
    () =>
      Arr.makeBy(9, (i) => {
        const angle = (i / 9) * Math.PI * 2;
        return {
          angle,
          id: `t-${i}`,
          x: Math.cos(angle) * 0.044,
          z: Math.sin(angle) * 0.044,
        };
      }),
    []
  );

  return (
    <group position={position}>
      <group rotation={[0, 0, Math.PI / 2]}>
        {Arr.map(triplets, (t) => (
          <mesh key={t.id} position={[t.x, 0, t.z]}>
            <cylinderGeometry args={[0.009, 0.009, 0.14, 8]} />
            <MetalMaterial
              color={GENETICS_COLORS.centrioleBrass}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>
      <group position={[0, 0.04, 0.055]} rotation={[Math.PI / 2, 0.3, 0]}>
        {Arr.map(triplets, (t) => (
          <mesh key={`d-${t.id}`} position={[t.x * 0.85, 0, t.z * 0.85]}>
            <cylinderGeometry args={[0.008, 0.008, 0.11, 8]} />
            <MetalMaterial
              color={GENETICS_COLORS.brassPolished}
              roughness={0.32}
            />
          </mesh>
        ))}
      </group>
      <mesh>
        <sphereGeometry args={[0.095, 18, 16]} />
        <meshPhysicalMaterial
          color={GENETICS_COLORS.spindleFiber}
          emissive={GENETICS_COLORS.spindleFiber}
          emissiveIntensity={0.45}
          opacity={0.22}
          roughness={0.2}
          transparent
        />
      </mesh>
    </group>
  );
}

/** Translucent microtubule spindle apparatus with twin orthogonal centriole centrosomes. */
export function SpindleApparatus({
  position = [0, 0.62, 0],
  span = 1.65,
}: {
  readonly position?: readonly [number, number, number];
  readonly span?: number;
}) {
  const half = span / 2;
  const fiberGeometries = useMemo(() => {
    const configs = [
      { archY: 0.42, archZ: 0.16, id: "f0" },
      { archY: 0.28, archZ: -0.22, id: "f1" },
      { archY: 0.14, archZ: 0.28, id: "f2" },
      { archY: 0, archZ: -0.26, id: "f3" },
      { archY: -0.14, archZ: 0.24, id: "f4" },
      { archY: -0.28, archZ: -0.18, id: "f5" },
      { archY: -0.42, archZ: 0.12, id: "f6" },
    ] as const;
    return Arr.map(configs, (cfg) => {
      const curve = new CatmullRomCurve3([
        new Vector3(-half, 0, 0),
        new Vector3(-half * 0.45, cfg.archY * 0.78, cfg.archZ * 0.78),
        new Vector3(0, cfg.archY, cfg.archZ),
        new Vector3(half * 0.45, cfg.archY * 0.78, cfg.archZ * 0.78),
        new Vector3(half, 0, 0),
      ]);
      return {
        geo: new TubeGeometry(curve, 32, 0.0055, 8, false),
        id: cfg.id,
      };
    });
  }, [half]);

  useEffect(
    () => () => {
      for (const item of fiberGeometries) {
        item.geo.dispose();
      }
    },
    [fiberGeometries]
  );

  return (
    <group position={position}>
      <CentriolePole position={[-half, 0, 0]} />
      <CentriolePole position={[half, 0, 0]} />
      {Arr.map(fiberGeometries, (fiber) => (
        <mesh geometry={fiber.geo} key={fiber.id}>
          <meshPhysicalMaterial
            color={GENETICS_COLORS.spindleFiber}
            emissive={GENETICS_COLORS.spindleFiber}
            emissiveIntensity={0.42}
            opacity={0.44}
            roughness={0.22}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
