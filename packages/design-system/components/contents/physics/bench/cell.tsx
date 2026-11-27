import { Post } from "@repo/design-system/components/contents/physics/bench/lead";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { getColor } from "@repo/design-system/lib/color";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Where the leads of a dry cell meet its holder, the positive end first, on the board it stands on. */
const CELL_POSTS = [
  [0.42, 0, 0],
  [-0.42, 0, 0],
] as const;

/** Paints the printed jacket of a dry cell: its colour, a bright band near the positive end, and fine pinstripes. */
function paintJacket() {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = APPARATUS_COLORS.cellJacket;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = APPARATUS_COLORS.cellStripe;
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillRect(0, 30, 256, 3);
  ctx.fillStyle = getColor("WHITE");
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 100, 256, 2);
  ctx.fillRect(0, 108, 256, 1);
  ctx.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A size D dry cell lying in its holder on the board, its positive cap toward
 * +x: a printed steel jacket, a nickel cap and base, and a bakelite cradle
 * with a spring clip and a binding post at each end.
 */
export function DryCell() {
  const jacket = useMemo(paintJacket, []);
  useEffect(() => () => jacket?.dispose(), [jacket]);

  return (
    <group>
      <mesh castShadow position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.98, 0.04, 0.3]} />
        <Matter of="bakelite" />
      </mesh>
      {Arr.map([-0.34, 0.34] as const, (x) => (
        <mesh castShadow key={x} position={[x, 0.11, 0]}>
          <boxGeometry args={[0.012, 0.18, 0.2]} />
          <Matter of="nickel" />
        </mesh>
      ))}
      <group position={[0, 0.15, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.56, 40]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            clearcoatRoughness={0.25}
            color={jacket === null ? BENCH_COLORS.battery : getColor("WHITE")}
            map={jacket}
            metalness={0.2}
            roughness={0.36}
          />
        </mesh>
        <mesh position={[0, 0.284, 0]}>
          <cylinderGeometry args={[0.1, 0.105, 0.012, 40]} />
          <Matter of="nickel" />
        </mesh>
        <mesh position={[0, 0.305, 0]}>
          <cylinderGeometry args={[0.032, 0.036, 0.034, 24]} />
          <Matter of="nickel" />
        </mesh>
        <mesh position={[0, -0.284, 0]}>
          <cylinderGeometry args={[0.105, 0.1, 0.012, 40]} />
          <Matter of="nickel" />
        </mesh>
      </group>
      <Post color={APPARATUS_COLORS.leadRed} position={CELL_POSTS[0]} />
      <Post color={APPARATUS_COLORS.leadBlack} position={CELL_POSTS[1]} />
    </group>
  );
}

const VENTS = [-0.09, -0.03, 0.03, 0.09] as const;

/** Where the leads of a bench supply plug in, the positive socket first, measured from its middle on the bench. */
export const SUPPLY_SOCKETS = [
  [0.2, 0.12, 0.27],
  [0.06, 0.12, 0.27],
] as const;

/**
 * A low-voltage bench power supply: an enamelled steel case with a dark front
 * panel, a voltage knob turned to `share` of its travel, a lit display that
 * shows the reading given as its children, and a red and a black 4 mm socket.
 */
export function Supply({
  children,
  share,
}: {
  readonly children: ReactNode;
  readonly share: number;
}) {
  return (
    <group>
      <mesh castShadow position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[0.72, 0.38, 0.5]} />
        <Matter color={APPARATUS_COLORS.caseEnamel} of="enamel" />
      </mesh>
      {Arr.map(VENTS, (y) => (
        <mesh key={y} position={[0.362, 0.22 + y, 0]}>
          <boxGeometry args={[0.004, 0.018, 0.34]} />
          <Matter color={APPARATUS_COLORS.caseDark} of="paint" />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.252]}>
        <boxGeometry args={[0.66, 0.32, 0.008]} />
        <Matter color={APPARATUS_COLORS.caseDark} of="anodised" />
      </mesh>
      <mesh position={[-0.14, 0.27, 0.258]}>
        <boxGeometry args={[0.3, 0.12, 0.006]} />
        <Matter color={BENCH_COLORS.lcdGlow} glow={0.35} of="epoxy" />
      </mesh>
      <group
        position={[-0.14, 0.12, 0.262]}
        rotation={[0, 0, Math.PI * 0.75 - share * Math.PI * 1.5]}
      >
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.062, 0.05, 28]} />
          <Matter of="bakelite" />
        </mesh>
        <mesh position={[0.036, 0, 0.027]}>
          <boxGeometry args={[0.034, 0.008, 0.004]} />
          <Matter color={APPARATUS_COLORS.caseEnamel} of="enamel" />
        </mesh>
      </group>
      {Arr.map(SUPPLY_SOCKETS, ([x, y, z], index) => (
        <group key={x} position={[x, y, z - 0.01]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.03, 24]} />
            <Matter
              color={
                index === 0
                  ? APPARATUS_COLORS.leadRed
                  : APPARATUS_COLORS.leadBlack
              }
              of="plastic"
            />
          </mesh>
          <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.012, 16]} />
            <Matter of="brass" />
          </mesh>
        </group>
      ))}
      <ThreeLabel
        color={BENCH_COLORS.lcdInk}
        fontSize="compact"
        maximumFontSize={15}
        minimumFontSize={11}
        outlineColor={BENCH_COLORS.lcdHalo}
        outlineWidth={0.003}
        position={[-0.14, 0.27, 0.266]}
      >
        <span>{children}</span>
      </ThreeLabel>
    </group>
  );
}
