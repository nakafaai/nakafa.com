import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

const TEX_SIZE = 512;

const LEAF_PALETTES = {
  chlorotic: {
    base: SPECIMEN_COLORS.leafChloroticBase,
    edge: SPECIMEN_COLORS.leafChloroticEdge,
    mid: SPECIMEN_COLORS.leafChloroticMid,
    vein: SPECIMEN_COLORS.leafChloroticVein,
  },
  healthy: {
    base: SPECIMEN_COLORS.leafHealthyBase,
    edge: SPECIMEN_COLORS.leafHealthyEdge,
    mid: SPECIMEN_COLORS.leafHealthyMid,
    vein: SPECIMEN_COLORS.leafHealthyVein,
  },
  orchid: {
    base: SPECIMEN_COLORS.leafOrchidBase,
    edge: SPECIMEN_COLORS.leafOrchidEdge,
    mid: SPECIMEN_COLORS.leafOrchidMid,
    vein: SPECIMEN_COLORS.leafOrchidVein,
  },
  sepal: {
    base: SPECIMEN_COLORS.leafSepalBase,
    edge: SPECIMEN_COLORS.leafSepalEdge,
    mid: SPECIMEN_COLORS.leafSepalMid,
    vein: SPECIMEN_COLORS.leafSepalVein,
  },
} as const;

export function createBotanicalCanvas(size = TEX_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d") };
}

export function finalizeBotanicalTexture(
  canvas: HTMLCanvasElement,
  srgb: boolean,
  repeat = false
): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  if (srgb) {
    tex.colorSpace = SRGBColorSpace;
  }
  if (repeat) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
  }
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function paintLeafMottling(
  col: CanvasRenderingContext2D,
  rough: CanvasRenderingContext2D,
  s: number
) {
  for (let i = 0; i < 420; i += 1) {
    const rx = valueNoise(i * 1.7, 3.1, 64) * s;
    const ry = valueNoise(5.3, i * 2.1, 64) * s;
    const rad = 4 + valueNoise(i * 3.7, i * 0.9, 32) * 18;
    col.fillStyle =
      i % 2 === 0
        ? SPECIMEN_COLORS.leafMottleDark
        : SPECIMEN_COLORS.leafMottleLight;
    col.beginPath();
    col.arc(rx, ry, rad, 0, Math.PI * 2);
    col.fill();

    rough.fillStyle =
      i % 3 === 0 ? SPECIMEN_COLORS.roughLight : SPECIMEN_COLORS.roughDark;
    rough.beginPath();
    rough.arc(rx, ry, rad * 0.8, 0, Math.PI * 2);
    rough.fill();
  }
}

function paintLeafVeins(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D,
  veinColor: string,
  parallel: boolean,
  s: number
) {
  col.lineCap = "round";
  bump.lineCap = "round";
  col.strokeStyle = veinColor;
  col.lineWidth = 10;
  col.beginPath();
  col.moveTo(s * 0.5, 0);
  col.lineTo(s * 0.5, s * 0.96);
  col.stroke();

  bump.strokeStyle = SPECIMEN_COLORS.bumpHigh;
  bump.lineWidth = 12;
  bump.beginPath();
  bump.moveTo(s * 0.5, 0);
  bump.lineTo(s * 0.5, s * 0.96);
  bump.stroke();

  if (parallel) {
    for (let k = 1; k <= 11; k += 1) {
      const x = (k / 12) * s;
      col.strokeStyle = veinColor;
      col.globalAlpha = 0.42;
      col.lineWidth = 2;
      col.beginPath();
      col.moveTo(x, 0);
      col.lineTo(x, s);
      col.stroke();
      bump.strokeStyle = SPECIMEN_COLORS.bumpSoft;
      bump.lineWidth = 2.5;
      bump.beginPath();
      bump.moveTo(x, 0);
      bump.lineTo(x, s);
      bump.stroke();
    }
    col.globalAlpha = 1;
    return;
  }

  for (let p = 1; p <= 10; p += 1) {
    const y0 = (p / 11.2) * s;
    const reach = s * (0.44 - Math.abs(p / 10 - 0.45) * 0.22);
    for (const side of [-1, 1] as const) {
      col.strokeStyle = veinColor;
      col.globalAlpha = 0.72;
      col.lineWidth = 3.2 - (p / 10) * 1.4;
      col.beginPath();
      col.moveTo(s * 0.5, y0);
      col.quadraticCurveTo(
        s * 0.5 + side * reach * 0.55,
        y0 + s * 0.035,
        s * 0.5 + side * reach,
        y0 + s * 0.11
      );
      col.stroke();

      bump.strokeStyle = SPECIMEN_COLORS.bumpLight;
      bump.lineWidth = 4.2 - (p / 10) * 1.6;
      bump.beginPath();
      bump.moveTo(s * 0.5, y0);
      bump.quadraticCurveTo(
        s * 0.5 + side * reach * 0.55,
        y0 + s * 0.035,
        s * 0.5 + side * reach,
        y0 + s * 0.11
      );
      bump.stroke();
    }
  }
  col.globalAlpha = 1;
}

/**
 * Generates high-resolution botanical leaf PBR maps (albedo + vein bump +
 * epidermal roughness) with natural chlorophyll pigment mottling, raised
 * central midrib, arching pinnate lateral veins, and fine reticulate network.
 */
export function useLeafTextures(
  variant: "chlorotic" | "healthy" | "orchid" | "sepal" = "healthy"
) {
  const maps = useMemo(() => {
    const col = createBotanicalCanvas();
    const bump = createBotanicalCanvas();
    const rough = createBotanicalCanvas();
    const s = TEX_SIZE;
    const palette = LEAF_PALETTES[variant];

    if (col.ctx !== null && bump.ctx !== null && rough.ctx !== null) {
      const grad = col.ctx.createLinearGradient(0, 0, 0, s);
      grad.addColorStop(0, palette.base);
      grad.addColorStop(0.55, palette.mid);
      grad.addColorStop(1, palette.edge);
      col.ctx.fillStyle = grad;
      col.ctx.fillRect(0, 0, s, s);

      bump.ctx.fillStyle = SPECIMEN_COLORS.bumpMid;
      bump.ctx.fillRect(0, 0, s, s);
      rough.ctx.fillStyle = SPECIMEN_COLORS.bumpWarm;
      rough.ctx.fillRect(0, 0, s, s);

      paintLeafMottling(col.ctx, rough.ctx, s);
      paintLeafVeins(col.ctx, bump.ctx, palette.vein, variant === "orchid", s);
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false),
      map: finalizeBotanicalTexture(col.canvas, true),
      roughnessMap: finalizeBotanicalTexture(rough.canvas, false),
    };
  }, [variant]);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
      maps.roughnessMap.dispose();
    },
    [maps]
  );

  return maps;
}

/**
 * Generates radial-veined silky botanical petal PBR maps (deep nectar-guide
 * throat transitioning to luminous blush margin, or muted sage wind bract).
 */
export function usePetalTextures(variant: "orchid" | "rose" | "wind" = "rose") {
  const maps = useMemo(() => {
    const col = createBotanicalCanvas();
    const bump = createBotanicalCanvas();
    const s = TEX_SIZE;

    if (col.ctx !== null && bump.ctx !== null) {
      const grad = col.ctx.createLinearGradient(0, 0, 0, s);
      if (variant === "wind") {
        grad.addColorStop(0, SPECIMEN_COLORS.petalWindBase);
        grad.addColorStop(0.55, SPECIMEN_COLORS.petalWindMid);
        grad.addColorStop(1, SPECIMEN_COLORS.petalWindTip);
      } else if (variant === "orchid") {
        grad.addColorStop(0, SPECIMEN_COLORS.orchidPetalBase);
        grad.addColorStop(0.32, SPECIMEN_COLORS.orchidPetalMid);
        grad.addColorStop(0.75, SPECIMEN_COLORS.orchidPetalEdge);
        grad.addColorStop(1, SPECIMEN_COLORS.orchidPetalTip);
      } else {
        grad.addColorStop(0, SPECIMEN_COLORS.petalRoseBase);
        grad.addColorStop(0.24, SPECIMEN_COLORS.petalRoseMid);
        grad.addColorStop(0.68, SPECIMEN_COLORS.petalRoseEdge);
        grad.addColorStop(1, SPECIMEN_COLORS.petalRoseTip);
      }
      col.ctx.fillStyle = grad;
      col.ctx.fillRect(0, 0, s, s);

      bump.ctx.fillStyle = SPECIMEN_COLORS.bumpMidSoft;
      bump.ctx.fillRect(0, 0, s, s);

      for (let i = -9; i <= 9; i += 1) {
        const endX = s * 0.5 + (i / 9) * s * 0.48;
        const ctrlX = s * 0.5 + (i / 9) * s * 0.24;
        col.ctx.strokeStyle =
          variant === "wind"
            ? SPECIMEN_COLORS.petalWindVein
            : SPECIMEN_COLORS.petalRoseVein;
        col.ctx.lineWidth = Math.abs(i) < 3 ? 3.2 : 1.9;
        col.ctx.beginPath();
        col.ctx.moveTo(s * 0.5, 0);
        col.ctx.quadraticCurveTo(ctrlX, s * 0.48, endX, s * 0.96);
        col.ctx.stroke();

        bump.ctx.strokeStyle = SPECIMEN_COLORS.bumpVein;
        bump.ctx.lineWidth = 2.4;
        bump.ctx.beginPath();
        bump.ctx.moveTo(s * 0.5, 0);
        bump.ctx.quadraticCurveTo(ctrlX, s * 0.48, endX, s * 0.96);
        bump.ctx.stroke();
      }
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false),
      map: finalizeBotanicalTexture(col.canvas, true),
    };
  }, [variant]);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
    },
    [maps]
  );

  return maps;
}

/**
 * Generates fibrous herbaceous stem PBR maps with longitudinal vascular
 * bundles and organic lenticel speckles.
 */
export function useStemTextures() {
  const maps = useMemo(() => {
    const col = createBotanicalCanvas(256);
    const bump = createBotanicalCanvas(256);
    const s = 256;

    if (col.ctx !== null && bump.ctx !== null) {
      col.ctx.fillStyle = SPECIMEN_COLORS.stemBase;
      col.ctx.fillRect(0, 0, s, s);
      bump.ctx.fillStyle = SPECIMEN_COLORS.bumpWarm;
      bump.ctx.fillRect(0, 0, s, s);

      for (let x = 0; x < s; x += 4) {
        const tone = valueNoise(x * 0.35, 2.4, 32);
        col.ctx.fillStyle =
          tone > 0.5
            ? SPECIMEN_COLORS.stemFiberLight
            : SPECIMEN_COLORS.stemFiberDark;
        col.ctx.fillRect(x, 0, 2, s);
        bump.ctx.fillStyle =
          tone > 0.5 ? SPECIMEN_COLORS.bumpSubtle : SPECIMEN_COLORS.bumpLow;
        bump.ctx.fillRect(x, 0, 2, s);
      }
      for (let i = 0; i < 60; i += 1) {
        const lx = valueNoise(i * 4.3, 1.1, 64) * s;
        const ly = valueNoise(2.7, i * 3.9, 64) * s;
        col.ctx.fillStyle = SPECIMEN_COLORS.stemLenticel;
        col.ctx.fillRect(lx, ly, 2, 7);
      }
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false, true),
      map: finalizeBotanicalTexture(col.canvas, true, true),
    };
  }, []);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
    },
    [maps]
  );

  return maps;
}

function ripenessBucket(ripeness: number): "green" | "ripe" | "turning" {
  if (ripeness > 0.8) {
    return "ripe";
  }
  if (ripeness > 0.3) {
    return "turning";
  }
  return "green";
}

/**
 * Generates heirloom fruit epidermis PBR maps transitioning organically from
 * matte olive-green through coral-apricot blush to deep glossy crimson.
 */
export function useFruitTextures(ripeness: number) {
  const bucket = ripenessBucket(ripeness);
  const maps = useMemo(() => {
    const col = createBotanicalCanvas(256);
    const bump = createBotanicalCanvas(256);
    const s = 256;

    if (col.ctx !== null && bump.ctx !== null) {
      const grad = col.ctx.createLinearGradient(0, 0, 0, s);
      if (bucket === "ripe") {
        grad.addColorStop(0, SPECIMEN_COLORS.fruitRipeBase);
        grad.addColorStop(0.22, SPECIMEN_COLORS.fruitRipeMid);
        grad.addColorStop(0.75, SPECIMEN_COLORS.fruitRipeShade);
        grad.addColorStop(1, SPECIMEN_COLORS.fruitRipeDeep);
      } else if (bucket === "turning") {
        grad.addColorStop(0, SPECIMEN_COLORS.fruitTurnBase);
        grad.addColorStop(0.35, SPECIMEN_COLORS.fruitTurnMid);
        grad.addColorStop(0.78, SPECIMEN_COLORS.fruitTurnShade);
        grad.addColorStop(1, SPECIMEN_COLORS.fruitTurnDeep);
      } else {
        grad.addColorStop(0, SPECIMEN_COLORS.fruitGreenBase);
        grad.addColorStop(0.45, SPECIMEN_COLORS.fruitGreenMid);
        grad.addColorStop(0.85, SPECIMEN_COLORS.fruitGreenLight);
        grad.addColorStop(1, SPECIMEN_COLORS.fruitGreenTip);
      }
      col.ctx.fillStyle = grad;
      col.ctx.fillRect(0, 0, s, s);

      bump.ctx.fillStyle = SPECIMEN_COLORS.bumpNeutral;
      bump.ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 240; i += 1) {
        const px = valueNoise(i * 2.9, 6.1, 64) * s;
        const py = valueNoise(1.7, i * 3.3, 64) * s;
        col.ctx.fillStyle = SPECIMEN_COLORS.fruitPore;
        col.ctx.fillRect(px, py, 1.5, 1.5);
        bump.ctx.fillStyle =
          i % 2 === 0
            ? SPECIMEN_COLORS.bumpTinyHigh
            : SPECIMEN_COLORS.bumpTinyLow;
        bump.ctx.fillRect(px, py, 2, 2);
      }
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false, true),
      map: finalizeBotanicalTexture(col.canvas, true, true),
    };
  }, [bucket]);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
    },
    [maps]
  );

  return maps;
}
