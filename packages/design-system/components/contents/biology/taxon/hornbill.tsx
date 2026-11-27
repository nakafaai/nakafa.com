import { useFrame } from "@react-three/fiber";
import { buildStemGeometry } from "@repo/design-system/components/contents/biology/botanical";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  LatheGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

const BODY_LENGTH = 0.36;
const BODY_PROFILE = [
  [0, 0.012],
  [0.08, 0.046],
  [0.22, 0.078],
  [0.42, 0.094],
  [0.62, 0.088],
  [0.8, 0.07],
  [0.93, 0.054],
  [1, 0.046],
  [1.05, 0],
] as const;
const STUMP_PROFILE = [
  [0.12, 0],
  [0.088, 0.05],
  [0.076, 0.15],
  [0.072, 0.3],
  [0, 0.3],
] as const;
const TOES = [-0.5, 0, 0.5] as const;

/** A grey height map of overlapping feather tips, row over row, for the plumage relief. */
function createFeatherRelief() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = CLASSIFICATION_COLORS.featherLow;
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 17; row += 1) {
      for (let col = -1; col < 9; col += 1) {
        const x = (col + (row % 2) * 0.5) * 32 + 16;
        const y = row * 16;
        const tip = ctx.createLinearGradient(x, y - 22, x, y + 4);
        tip.addColorStop(0, CLASSIFICATION_COLORS.featherLow);
        tip.addColorStop(1, CLASSIFICATION_COLORS.featherHigh);
        ctx.fillStyle = tip;
        ctx.beginPath();
        ctx.ellipse(x, y - 8, 15, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CLASSIFICATION_COLORS.featherLow;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }
  }
  const relief = new CanvasTexture(canvas);
  relief.wrapS = RepeatWrapping;
  relief.wrapT = RepeatWrapping;
  return relief;
}

/** The bill's colours from its red base through yellow to its ivory tip, drawn along the tube. */
function createBillSkin(base: string, middle: string, tip: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    const ramp = ctx.createLinearGradient(0, 128, 0, 0);
    ramp.addColorStop(0, base);
    ramp.addColorStop(0.45, middle);
    ramp.addColorStop(1, tip);
    ctx.fillStyle = ramp;
    ctx.fillRect(0, 0, 8, 128);
  }
  const skin = new CanvasTexture(canvas);
  skin.colorSpace = SRGBColorSpace;
  return skin;
}

/** The white tail with its one broad black band, and the vane lines of each feather. */
function createTailSkin() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = CLASSIFICATION_COLORS.hornbillTail;
    ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = CLASSIFICATION_COLORS.hornbillPlumage;
    ctx.fillRect(0, 96, 128, 78);
    ctx.fillRect(0, 0, 128, 26);
    ctx.strokeStyle = CLASSIFICATION_COLORS.featherLow;
    ctx.globalAlpha = 0.35;
    for (let vane = 1; vane < 6; vane += 1) {
      ctx.beginPath();
      ctx.moveTo(vane * 21.3, 0);
      ctx.lineTo(vane * 21.3, 256);
      ctx.stroke();
    }
  }
  const skin = new CanvasTexture(canvas);
  skin.colorSpace = SRGBColorSpace;
  return skin;
}

function useHornbillParts() {
  const parts = useMemo(() => {
    const body = new LatheGeometry(
      Arr.map(
        BODY_PROFILE,
        ([t, radius]) => new Vector2(radius, t * BODY_LENGTH)
      ),
      28
    );
    const height = body.getAttribute("position");
    const plumage = new Color(CLASSIFICATION_COLORS.hornbillPlumage);
    const belly = new Color(CLASSIFICATION_COLORS.hornbillTail);
    const tint = new Color();
    const colors = new Float32Array(height.count * 3);
    for (let index = 0; index < height.count; index += 1) {
      const low = 1 - Math.min(1, Math.max(0, height.getY(index) / 0.1 - 0.35));
      tint.copy(plumage).lerp(belly, low);
      colors.set([tint.r, tint.g, tint.b], index * 3);
    }
    body.setAttribute("color", new BufferAttribute(colors, 3));

    const neck = buildStemGeometry(
      [
        new Vector3(0.1, 0.4, 0),
        new Vector3(0.15, 0.475, 0),
        new Vector3(0.19, 0.53, 0),
        new Vector3(0.225, 0.565, 0),
      ],
      0.062,
      0.05,
      14,
      18
    );
    const bill = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.12, 0.004, 0),
        new Vector3(0.22, -0.03, 0),
        new Vector3(0.29, -0.085, 0),
      ],
      0.04,
      0.005,
      26,
      16
    );
    const casque = buildStemGeometry(
      [
        new Vector3(-0.045, 0.05, 0),
        new Vector3(0.05, 0.062, 0),
        new Vector3(0.13, 0.082, 0),
        new Vector3(0.175, 0.13, 0),
      ],
      0.034,
      0.008,
      22,
      14
    );
    const toe = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.03, 0.012, 0),
        new Vector3(0.052, -0.01, 0),
      ],
      0.008,
      0.003,
      8,
      6
    );

    const stump = new LatheGeometry(
      Arr.map(STUMP_PROFILE, ([radius, y]) => new Vector2(radius, y)),
      24
    );

    const outline = new Shape();
    outline.moveTo(-0.04, 0);
    outline.quadraticCurveTo(-0.062, -0.2, -0.045, -0.31);
    outline.quadraticCurveTo(0, -0.345, 0.045, -0.31);
    outline.quadraticCurveTo(0.062, -0.2, 0.04, 0);
    outline.closePath();
    const tail = new ShapeGeometry(outline, 12);
    const corner = tail.getAttribute("uv");
    for (let index = 0; index < corner.count; index += 1) {
      corner.setXY(
        index,
        (corner.getX(index) + 0.062) / 0.124,
        (corner.getY(index) + 0.345) / 0.345
      );
    }

    return {
      bill,
      billSkin: createBillSkin(
        CLASSIFICATION_COLORS.hornbillBeak,
        CLASSIFICATION_COLORS.hornbillBillMid,
        CLASSIFICATION_COLORS.hornbillBill
      ),
      body,
      casque,
      casqueSkin: createBillSkin(
        CLASSIFICATION_COLORS.hornbillBillMid,
        CLASSIFICATION_COLORS.hornbillBeak,
        CLASSIFICATION_COLORS.hornbillCasque
      ),
      neck,
      relief: createFeatherRelief(),
      stump,
      tail,
      tailSkin: createTailSkin(),
      toe,
    };
  }, []);

  useEffect(
    () => () => {
      parts.bill.dispose();
      parts.billSkin.dispose();
      parts.body.dispose();
      parts.casque.dispose();
      parts.casqueSkin.dispose();
      parts.neck.dispose();
      parts.relief.dispose();
      parts.stump.dispose();
      parts.tail.dispose();
      parts.tailSkin.dispose();
      parts.toe.dispose();
    },
    [parts]
  );
  return parts;
}

/**
 * Rhinoceros hornbill, Buceros rhinoceros, perched on a mossy log: glossy
 * black plumage with a feather relief, white belly and thighs, the white tail
 * with its one black band, and the long ivory bill under the upturned red and
 * yellow casque. While the card plays it looks around and its tail balances.
 */
export function HornbillSpecimen() {
  const parts = useHornbillParts();
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += simulationStep(delta);
    if (head.current) {
      head.current.rotation.y = Math.sin(time.current * 0.7) * 0.32;
      head.current.rotation.z = Math.sin(time.current * 1.1) * 0.05;
    }
    if (tail.current) {
      tail.current.rotation.z = -0.42 + Math.sin(time.current * 1.4) * 0.04;
    }
  });

  return (
    <group>
      <mesh castShadow geometry={parts.stump} receiveShadow>
        <SurfaceMaterial
          bump={0.9}
          color={CLASSIFICATION_COLORS.gardenTimber}
          repeat={[3, 2]}
          roughness={0.92}
          surface="bark"
        />
      </mesh>

      <group position={[0, 0.16, 0]}>
        <group position={[-0.02, 0.17, 0]} rotation={[0, 0, -0.5]}>
          <mesh castShadow geometry={parts.body} scale={[1, 1, 0.86]}>
            <meshPhysicalMaterial
              bumpMap={parts.relief}
              bumpScale={0.9}
              clearcoat={0.3}
              clearcoatRoughness={0.5}
              roughness={0.5}
              vertexColors
            />
          </mesh>
          {Arr.map([-1, 1] as const, (side) => (
            <mesh
              castShadow
              key={`wing-${side}`}
              position={[-0.02, 0.2, side * 0.066]}
              rotation={[side * 0.1, 0, 0.1]}
              scale={[0.6, 1.5, 0.22]}
            >
              <sphereGeometry args={[0.1, 20, 16]} />
              <meshPhysicalMaterial
                bumpMap={parts.relief}
                bumpScale={1.2}
                clearcoat={0.35}
                color={CLASSIFICATION_COLORS.hornbillPlumage}
                roughness={0.46}
              />
            </mesh>
          ))}
        </group>

        <mesh castShadow geometry={parts.neck}>
          <meshPhysicalMaterial
            bumpMap={parts.relief}
            bumpScale={0.7}
            color={CLASSIFICATION_COLORS.hornbillPlumage}
            roughness={0.5}
          />
        </mesh>
        <group position={[-0.04, 0.225, 0]} ref={tail} rotation={[0, 0, -0.42]}>
          <mesh
            castShadow
            geometry={parts.tail}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.5, 1, 1]}
          >
            <meshPhysicalMaterial
              map={parts.tailSkin}
              roughness={0.6}
              side={DoubleSide}
            />
          </mesh>
        </group>

        <group position={[0.235, 0.575, 0]} ref={head}>
          <mesh castShadow scale={[1.22, 1, 0.94]}>
            <sphereGeometry args={[0.06, 22, 18]} />
            <meshPhysicalMaterial
              bumpMap={parts.relief}
              bumpScale={0.5}
              color={CLASSIFICATION_COLORS.hornbillPlumage}
              roughness={0.48}
            />
          </mesh>
          <group position={[0.03, -0.006, 0]}>
            <mesh castShadow geometry={parts.bill} scale={[1, 1, 0.56]}>
              <meshPhysicalMaterial
                clearcoat={0.7}
                clearcoatRoughness={0.25}
                map={parts.billSkin}
                roughness={0.34}
              />
            </mesh>
            <mesh castShadow geometry={parts.casque} scale={[1, 1, 0.6]}>
              <meshPhysicalMaterial
                clearcoat={0.75}
                clearcoatRoughness={0.22}
                map={parts.casqueSkin}
                roughness={0.3}
              />
            </mesh>
          </group>
          {Arr.map([-1, 1] as const, (side) => (
            <group key={`eye-${side}`} position={[0.03, 0.012, side * 0.045]}>
              <mesh>
                <sphereGeometry args={[0.011, 12, 10]} />
                <meshPhysicalMaterial
                  clearcoat={1}
                  color={CLASSIFICATION_COLORS.hornbillEye}
                  roughness={0.15}
                />
              </mesh>
              <mesh position={[0.002, 0, side * 0.006]}>
                <sphereGeometry args={[0.006, 10, 8]} />
                <meshPhysicalMaterial
                  clearcoat={1}
                  color={CLASSIFICATION_COLORS.birdwingVein}
                  roughness={0.1}
                />
              </mesh>
            </group>
          ))}
        </group>

        {Arr.map([-1, 1] as const, (side) => (
          <group key={`leg-${side}`} position={[0.02, 0.14, side * 0.04]}>
            <mesh castShadow position={[0, 0.04, 0]} scale={[1, 1.5, 1]}>
              <sphereGeometry args={[0.036, 14, 12]} />
              <meshPhysicalMaterial
                bumpMap={parts.relief}
                bumpScale={0.6}
                color={CLASSIFICATION_COLORS.hornbillTail}
                roughness={0.62}
              />
            </mesh>
            {Arr.map(TOES, (spread) => (
              <mesh
                castShadow
                geometry={parts.toe}
                key={`toe-${spread}`}
                rotation={[0, spread, 0]}
              >
                <meshStandardMaterial
                  color={CLASSIFICATION_COLORS.hornbillFoot}
                  roughness={0.7}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
