import { useFrame, useThree } from "@react-three/fiber";
import {
  drawSheet,
  soleInk,
  solidInk,
} from "@repo/design-system/components/three/print/draw";
import { inkProgram } from "@repo/design-system/components/three/print/ink";
import {
  canvasPen,
  usePrintFaces,
} from "@repo/design-system/components/three/print/pen";
import {
  needsRedraw,
  printBudget,
  printPixels,
  screenDensity,
} from "@repo/design-system/components/three/print/sharp";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import type { StockSchema } from "@repo/design-system/components/three/print/stock";
import {
  finishOf,
  PLAIN_SUBSTRATE,
} from "@repo/design-system/components/three/print/stock";
import {
  arcSegments,
  sleeveArc,
} from "@repo/design-system/components/three/print/wrap";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { getColor } from "@repo/design-system/lib/color";
import { Option } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Camera, Object3D } from "three";
import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from "three";

type Stock = typeof StockSchema.Type;

/** How strongly a relief of 1 bends the light at the edge of a mark. */
const RELIEF = 0.9;

/** How far a wrapped print stands off its part, as a share of the part's radius, so the two never share a depth. */
const LIFT = 1.004;

/** Ink alone draws after the part it lies on, so clear glass under it never hides it. */
const DECAL_ORDER = 3;

/** How rough and metallic the part a print is mounted on is: the nearest mesh above it in the scene. */
function substrateOf(print: Object3D | null) {
  let part = print?.parent ?? null;
  while (part !== null) {
    if (part instanceof Mesh && part.material instanceof MeshStandardMaterial) {
      return {
        metalness: part.material.metalness,
        roughness: part.material.roughness,
      };
    }
    part = part.parent;
  }
  return PLAIN_SUBSTRATE;
}

/** How the camera sees a print that stands `distance` away. */
function viewOf(camera: Camera, distance: number) {
  if (camera instanceof PerspectiveCamera) {
    return {
      distance,
      fov: camera.getEffectiveFOV(),
      kind: "perspective" as const,
    };
  }
  if (camera instanceof OrthographicCamera) {
    return { kind: "orthographic" as const, zoom: camera.zoom };
  }
  return { kind: "orthographic" as const, zoom: 0 };
}

/** One pass of a sheet as a texture the renderer mipmaps and keeps sharp at a slant. */
function passTexture(
  sheet: Sheet,
  pixels: { readonly height: number; readonly width: number },
  pass: Parameters<typeof drawSheet>[3],
  faces: ReturnType<typeof usePrintFaces>,
  anisotropy: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (context !== null) {
    drawSheet(canvasPen(context, faces), sheet, pixels, pass);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = pass === "cover" ? NoColorSpace : SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * The textures of a sheet: its coverage, which says where the ink lies and
 * how it stands in relief, and an image of its colours only where it is
 * printed in more than one ink.
 */
function paintPrint(
  sheet: Sheet,
  pixels: { readonly height: number; readonly width: number },
  faces: ReturnType<typeof usePrintFaces>,
  anisotropy: number
) {
  return {
    cover: passTexture(sheet, pixels, "cover", faces, anisotropy),
    tint: Option.isSome(soleInk(sheet))
      ? null
      : passTexture(sheet, pixels, "tint", faces, anisotropy),
  };
}

/** A material that lays ink on a print: a standard one whose program reads the print's coverage sharp. */
function inkMaterial() {
  const uniforms = {
    printGlow: { value: 0 },
    printGround: { value: new Color() },
  };
  const material = new MeshPhysicalMaterial({
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (program) => {
    program.uniforms.printGlow = uniforms.printGlow;
    program.uniforms.printGround = uniforms.printGround;
    program.fragmentShader = inkProgram(program.fragmentShader);
  };
  return { material, uniforms };
}

/**
 * The material and mesh handle of one print: it draws the sheet at the size
 * the reader sees it, draws it again when they zoom in, lights it as its
 * stock is lit on the part it is mounted on, and frees every texture it
 * made when the sheet changes or the print leaves the scene.
 */
function usePrint(sheet: Sheet, stock: Stock) {
  const { tier } = useStage();
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const get = useThree((state) => state.get);
  const faces = usePrintFaces();
  const mesh = useRef<Mesh>(null);
  const budget = printBudget(tier);
  const limit = Math.min(budget.limit, gl.capabilities.maxTextureSize);
  const anisotropy = Math.min(
    budget.anisotropy,
    gl.capabilities.getMaxAnisotropy()
  );
  const [pixels, setPixels] = useState(() => printPixels(sheet, 0, limit));
  const drawn = useRef(pixels);
  const scratch = useMemo(
    () => ({ camera: new Vector3(), print: new Vector3() }),
    []
  );
  const { material, uniforms } = useMemo(inkMaterial, []);
  useEffect(() => () => material.dispose(), [material]);

  const sharpen = useMemo(
    () => (camera: Camera, bufferHeight: number) => {
      const print = mesh.current;
      if (print === null) {
        return;
      }
      print.getWorldPosition(scratch.print);
      camera.getWorldPosition(scratch.camera);
      const density = screenDensity(
        viewOf(camera, scratch.print.distanceTo(scratch.camera)),
        bufferHeight,
        print.matrixWorld.getMaxScaleOnAxis()
      );
      const wanted = printPixels(sheet, density, limit);
      if (needsRedraw(drawn.current, wanted)) {
        drawn.current = wanted;
        setPixels(wanted);
      }
    },
    [limit, scratch, sheet]
  );

  // The first image is already as sharp as the reader's first look at it.
  useLayoutEffect(() => {
    const state = get();
    mesh.current?.updateWorldMatrix(true, false);
    sharpen(state.camera, state.size.height * state.viewport.dpr);
  }, [get, sharpen]);

  useFrame((state) => {
    sharpen(state.camera, state.size.height * state.viewport.dpr);
  });

  useLayoutEffect(() => {
    const finish = finishOf(stock, substrateOf(mesh.current));
    const textures = paintPrint(sheet, pixels, faces, anisotropy);
    const grounded = sheet.ground !== undefined;
    material.map = textures.tint;
    material.color.set(
      Option.getOrElse(soleInk(sheet), () => getColor("WHITE"))
    );
    material.alphaMap = textures.cover;
    material.bumpMap = finish.relief === 0 ? null : textures.cover;
    material.bumpScale = finish.relief * RELIEF;
    material.clearcoat = finish.coat;
    material.clearcoatRoughness = 0.12;
    material.metalness = finish.metalness;
    material.roughness = finish.roughness;
    material.transparent = !grounded;
    material.depthWrite = grounded;
    material.defines = {
      ...(grounded ? { PRINT_GROUND: "" } : {}),
      ...(solidInk(sheet) ? {} : { PRINT_SOFT: "" }),
    };
    uniforms.printGlow.value = finish.glow;
    uniforms.printGround.value.set(sheet.ground ?? getColor("BLACK"));
    material.needsUpdate = true;
    invalidate();
    return () => {
      textures.tint?.dispose();
      textures.cover.dispose();
    };
  }, [anisotropy, faces, invalidate, material, pixels, sheet, stock, uniforms]);

  return {
    around: budget.around,
    material,
    mesh,
    order: sheet.ground === undefined ? DECAL_ORDER : 0,
  };
}

/**
 * A print on a flat part: the sheet at its real size, its middle at the
 * origin, facing +z. Mount it on the face it is printed on.
 *
 * @param sheet - What is printed; keep one sheet for as long as the print does not change
 * @param stock - How the ink meets what it is printed on
 */
export function PrintFace({
  sheet,
  stock,
}: {
  readonly sheet: Sheet;
  readonly stock: Stock;
}) {
  const print = usePrint(sheet, stock);

  return (
    <mesh material={print.material} ref={print.mesh} renderOrder={print.order}>
      <planeGeometry args={[sheet.width, sheet.height]} />
    </mesh>
  );
}

/**
 * A print on a round flat part, such as the face of a dial: the circle
 * inside a square sheet, its middle at the origin, facing +z.
 *
 * @param sheet - What is printed, on a square sheet as wide as the face
 * @param stock - How the ink meets what it is printed on
 */
export function PrintDisc({
  sheet,
  stock,
}: {
  readonly sheet: Sheet;
  readonly stock: Stock;
}) {
  const print = usePrint(sheet, stock);

  return (
    <mesh material={print.material} ref={print.mesh} renderOrder={print.order}>
      <circleGeometry args={[sheet.width / 2, print.around]} />
    </mesh>
  );
}

/**
 * A print wrapped round an upright cylinder, such as the scale of a beaker
 * or the label of a bottle: the sheet keeps its real width along the curve,
 * its middle faces +z, and the cylinder's axis is the y axis.
 *
 * @param radius - The radius of the part the print lies on
 * @param sheet - What is printed
 * @param stock - How the ink meets what it is printed on
 */
export function PrintSleeve({
  radius,
  sheet,
  stock,
}: {
  readonly radius: number;
  readonly sheet: Sheet;
  readonly stock: Stock;
}) {
  const print = usePrint(sheet, stock);
  const arc = sleeveArc(sheet.width, radius);

  return (
    <mesh material={print.material} ref={print.mesh} renderOrder={print.order}>
      <cylinderGeometry
        args={[
          radius * LIFT,
          radius * LIFT,
          sheet.height,
          arcSegments(arc.length, print.around),
          1,
          true,
          arc.start,
          arc.length,
        ]}
      />
    </mesh>
  );
}

/**
 * A print over a whole ball, such as the seams of a sports ball: the sheet
 * `ballSheet` gives runs once round the equator and from pole to pole.
 *
 * @param radius - The radius of the ball the print lies on
 * @param sheet - What is printed, on the sheet `ballSheet(radius)` sizes
 * @param stock - How the ink meets what it is printed on
 */
export function PrintBall({
  radius,
  sheet,
  stock,
}: {
  readonly radius: number;
  readonly sheet: Sheet;
  readonly stock: Stock;
}) {
  const print = usePrint(sheet, stock);

  return (
    <mesh material={print.material} ref={print.mesh} renderOrder={print.order}>
      <sphereGeometry
        args={[radius * LIFT, print.around, Math.ceil(print.around / 2)]}
      />
    </mesh>
  );
}
