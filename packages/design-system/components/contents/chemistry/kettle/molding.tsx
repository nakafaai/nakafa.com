import { useFrame } from "@react-three/fiber";
import { KETTLE_Z } from "@repo/design-system/components/contents/chemistry/kettle/vessel";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { ExtrudeGeometry, Shape } from "three";

const OAK_SLATS = Arr.range(0, 5);
const SOAP_BAR_X = [-0.105, 0, 0.105] as const;

/** Smoothly bevelled rectangular artisan soap bar. */
function buildSoapBarGeometry(): ExtrudeGeometry {
  const w = 0.042;
  const h = 0.064;
  const r = 0.009;
  const shape = new Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.007,
    bevelThickness: 0.007,
    depth: 0.024,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Artisan soap molding bench: slatted oak drying rack, white glazed porcelain
 * molding tray, three bevelled cream soap bars with oval medallions, and a
 * machined stainless press stamp hovering above.
 */
export function MoldingStation({ playing }: { readonly playing: boolean }) {
  const barGeo = useMemo(buildSoapBarGeometry, []);
  const stampRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  useEffect(() => () => barGeo.dispose(), [barGeo]);

  useFrame((_, delta) => {
    if (!playing || stampRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 2.2;
    const pressOffset = (1 - Math.cos(phaseRef.current)) * 0.022;
    stampRef.current.position.y = 0.128 - pressOffset;
  });

  return (
    <group position={[0, 0, KETTLE_Z]}>
      {Arr.map([-0.15, 0.15] as const, (x) => (
        <mesh castShadow key={x} position={[x, 0.008, 0]} receiveShadow>
          <boxGeometry args={[0.028, 0.016, 0.23]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.oak}
            roughness={0.72}
          />
        </mesh>
      ))}
      {Arr.map(OAK_SLATS, (index) => (
        <mesh
          castShadow
          key={index}
          position={[0, 0.021, -0.095 + index * 0.038]}
          receiveShadow
        >
          <boxGeometry args={[0.42, 0.01, 0.026]} />
          <meshStandardMaterial color={INSTRUMENT_COLORS.oak} roughness={0.7} />
        </mesh>
      ))}
      <group position={[0, 0.026, 0]}>
        <mesh castShadow position={[0, 0.006, 0]} receiveShadow>
          <boxGeometry args={[0.36, 0.012, 0.2]} />
          <meshPhysicalMaterial
            clearcoat={0.85}
            clearcoatRoughness={0.14}
            color={BENCH_COLORS.ceramicTile}
            roughness={0.2}
          />
        </mesh>
        {Arr.map([-0.095, 0.095] as const, (z) => (
          <mesh castShadow key={z} position={[0, 0.018, z]}>
            <boxGeometry args={[0.36, 0.014, 0.01]} />
            <meshPhysicalMaterial
              clearcoat={0.85}
              color={BENCH_COLORS.ceramicTile}
              roughness={0.2}
            />
          </mesh>
        ))}
        {Arr.map([-0.175, 0.175] as const, (x) => (
          <mesh castShadow key={x} position={[x, 0.018, 0]}>
            <boxGeometry args={[0.01, 0.014, 0.18]} />
            <meshPhysicalMaterial
              clearcoat={0.85}
              color={BENCH_COLORS.ceramicTile}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>
      {Arr.map(SOAP_BAR_X, (x) => (
        <group key={x} position={[x, 0.045, 0]}>
          <mesh castShadow geometry={barGeo} receiveShadow>
            <meshPhysicalMaterial
              clearcoat={0.18}
              clearcoatRoughness={0.5}
              color={ORGANIC_COLORS.soapCream}
              roughness={0.44}
            />
          </mesh>
          <mesh
            position={[0, 0.032, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.8, 1.35, 1]}
          >
            <torusGeometry args={[0.018, 0.0022, 8, 28]} />
            <meshStandardMaterial
              color={BENCH_COLORS.ceramicTile}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.128, 0]} ref={stampRef}>
        <mesh castShadow>
          <boxGeometry args={[0.072, 0.014, 0.105]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
        </mesh>
        <mesh
          position={[0, -0.008, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.8, 1.35, 1]}
        >
          <torusGeometry args={[0.018, 0.0025, 8, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.011, 0.014, 0.092, 20]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        <mesh castShadow position={[0, 0.104, 0]}>
          <sphereGeometry args={[0.018, 18, 14]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}
