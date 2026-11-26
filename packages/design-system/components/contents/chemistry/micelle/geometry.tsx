import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

const CORNER_POSTS = [
  [-0.184, -0.094],
  [0.184, -0.094],
  [-0.184, 0.094],
  [0.184, 0.094],
] as const;

const WARP_Z = Arr.makeBy(9, (index) => -0.068 + index * 0.017);
const WEFT_X = Arr.makeBy(15, (index) => -0.147 + index * 0.021);

function createWovenStrandGeometry(
  length: number,
  cycles: number,
  phase: number,
  axis: "x" | "z"
) {
  const segments = 28;
  const pts = Arr.makeBy(segments + 1, (index) => {
    const u = index / segments;
    const coord = (u - 0.5) * length;
    const wave = Math.sin(u * Math.PI * 2 * cycles + phase) * 0.0024;
    return axis === "x"
      ? new Vector3(coord, wave, 0)
      : new Vector3(0, wave, coord);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), 44, 0.0038, 10, false);
}

/** Sleek stainless-framed borosilicate microfluidic wash-tank chamber resting on LabBench y = 0. */
export function WashTankChamber({ hasScum }: { readonly hasScum: boolean }) {
  return (
    <group>
      {/* Brushed stainless base bezel frame and rubber corner feet */}
      {Arr.map(CORNER_POSTS, ([x, z]) => (
        <mesh key={`foot-${x}-${z}`} position={[x * 0.94, 0.002, z * 0.9]}>
          <cylinderGeometry args={[0.009, 0.01, 0.004, 16]} />
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.9} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.009, 0]} receiveShadow>
        <boxGeometry args={[0.382, 0.012, 0.202]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </mesh>
      {/* Inner dark tank floor mat beneath glass */}
      <mesh position={[0, 0.0155, 0]} receiveShadow>
        <boxGeometry args={[0.362, 0.002, 0.182]} />
        <meshStandardMaterial color={BENCH_COLORS.trough} roughness={0.62} />
      </mesh>

      {/* 4 brushed stainless corner posts */}
      {Arr.map(CORNER_POSTS, ([x, z]) => (
        <mesh castShadow key={`post-${x}-${z}`} position={[x, 0.118, z]}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.214, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
        </mesh>
      ))}

      {/* Top stainless perimeter frame rails */}
      {Arr.map([-0.094, 0.094] as const, (z) => (
        <mesh key={`top-x-${z}`} position={[0, 0.223, z]}>
          <boxGeometry args={[0.376, 0.007, 0.008]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
      ))}
      {Arr.map([-0.184, 0.184] as const, (x) => (
        <mesh key={`top-z-${x}`} position={[x, 0.223, 0]}>
          <boxGeometry args={[0.008, 0.007, 0.194]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
        </mesh>
      ))}

      {/* Side microfluidic stainless wash-flow inlet and outlet barbs */}
      {Arr.map([-1, 1] as const, (sign) => (
        <group key={`barb-${sign}`} position={[sign * 0.196, 0.125, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.009, 0.014, 18]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
          </mesh>
          <mesh position={[sign * 0.014, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0055, 0.0068, 0.018, 16]} />
            <MetalMaterial color={CAR_COLORS.chrome} roughness={0.24} />
          </mesh>
        </group>
      ))}

      {/* Translucent aqueous wash medium inside chamber */}
      <mesh position={[0, 0.108, 0]}>
        <boxGeometry args={[0.358, 0.182, 0.178]} />
        <LiquidMaterial
          color={hasScum ? ORGANIC_COLORS.scumGray : ORGANIC_COLORS.waterBlue}
          opacity={hasScum ? 0.19 : 0.14}
        />
      </mesh>
      {/* Crisp water surface meniscus highlight */}
      <mesh position={[0, 0.1995, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.358, 0.178]} />
        <GlassMaterial
          color={
            hasScum ? ORGANIC_COLORS.saltCrystal : ORGANIC_COLORS.refineryCyan
          }
          opacity={0.28}
        />
      </mesh>

      {/* Borosilicate observation walls */}
      <mesh position={[0, 0.118, 0.093]} renderOrder={2}>
        <boxGeometry args={[0.362, 0.204, 0.003]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.18} />
      </mesh>
      <mesh position={[0, 0.118, -0.093]} renderOrder={2}>
        <boxGeometry args={[0.362, 0.204, 0.003]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.18} />
      </mesh>
      <mesh position={[-0.183, 0.118, 0]} renderOrder={2}>
        <boxGeometry args={[0.003, 0.204, 0.182]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
      </mesh>
      <mesh position={[0.183, 0.118, 0]} renderOrder={2}>
        <boxGeometry args={[0.003, 0.204, 0.182]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
      </mesh>
    </group>
  );
}

/** Genuine woven textile swatch built from crisscrossed wavy warp and weft yarn fibres. */
export function WovenFabricSwatch() {
  const { warpEven, warpOdd, weftEven, weftOdd } = useMemo(
    () => ({
      warpEven: createWovenStrandGeometry(0.32, 7.5, 0, "x"),
      warpOdd: createWovenStrandGeometry(0.32, 7.5, Math.PI, "x"),
      weftEven: createWovenStrandGeometry(0.156, 4.5, Math.PI / 2, "z"),
      weftOdd: createWovenStrandGeometry(0.156, 4.5, -Math.PI / 2, "z"),
    }),
    []
  );

  useEffect(
    () => () => {
      warpEven.dispose();
      warpOdd.dispose();
      weftEven.dispose();
      weftOdd.dispose();
    },
    [warpEven, warpOdd, weftEven, weftOdd]
  );

  return (
    <group position={[0, 0.023, 0]}>
      {Arr.map(WARP_Z, (z, index) => (
        <mesh
          castShadow
          geometry={index % 2 === 0 ? warpEven : warpOdd}
          key={`warp-${z}`}
          position={[0, 0, z]}
          receiveShadow
        >
          <meshStandardMaterial
            color={ORGANIC_COLORS.fabricSlate}
            roughness={0.86}
          />
        </mesh>
      ))}
      {Arr.map(WEFT_X, (x, index) => (
        <mesh
          castShadow
          geometry={index % 2 === 0 ? weftEven : weftOdd}
          key={`weft-${x}`}
          position={[x, 0, 0]}
          receiveShadow
        >
          <meshStandardMaterial
            color={
              index % 2 === 0
                ? ORGANIC_COLORS.fabricSlate
                : BENCH_COLORS.balanceFrame
            }
            roughness={0.84}
          />
        </mesh>
      ))}
    </group>
  );
}
