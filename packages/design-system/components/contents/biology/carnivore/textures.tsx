import {
  createBotanicalCanvas,
  finalizeBotanicalTexture,
} from "@repo/design-system/components/contents/biology/foliage";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { useEffect, useMemo } from "react";

const SIZE = 512;

function paintPitcherBody(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D,
  s: number
) {
  const grad = col.createLinearGradient(0, s, 0, 0);
  grad.addColorStop(0, SPECIMEN_COLORS.pitcherBase);
  grad.addColorStop(0.42, SPECIMEN_COLORS.pitcherMid);
  grad.addColorStop(0.82, SPECIMEN_COLORS.pitcherUpper);
  grad.addColorStop(1, SPECIMEN_COLORS.pitcherTop);
  col.fillStyle = grad;
  col.fillRect(0, 0, s, s);

  bump.fillStyle = SPECIMEN_COLORS.bumpTone;
  bump.fillRect(0, 0, s, s);

  for (let k = 0; k < 48; k += 1) {
    const x = (k / 48) * s;
    col.strokeStyle = SPECIMEN_COLORS.pitcherStripe;
    col.lineWidth = 2;
    col.beginPath();
    col.moveTo(x, 0);
    col.lineTo(x, s);
    col.stroke();

    bump.strokeStyle = SPECIMEN_COLORS.bumpVeinSoft;
    bump.lineWidth = 2.5;
    bump.beginPath();
    bump.moveTo(x, 0);
    bump.lineTo(x, s);
    bump.stroke();
  }

  col.fillStyle = SPECIMEN_COLORS.pitcherBlotch;
  for (let i = 0; i < 190; i += 1) {
    const bx = valueNoise(i * 2.3, 4.7, 64) * s;
    const by = valueNoise(7.1, i * 1.9, 64) * s * 0.92;
    const rx = 8 + valueNoise(i * 4.1, 1.3, 32) * 24;
    const ry = 10 + valueNoise(2.9, i * 3.7, 32) * 30;
    col.globalAlpha = 0.25 + 0.55 * (1 - by / s);
    col.beginPath();
    col.ellipse(bx, by, rx, ry, valueNoise(i, 9, 16) * Math.PI, 0, Math.PI * 2);
    col.fill();
  }
  col.globalAlpha = 1;
}

function paintPeristomeRim(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D,
  s: number
) {
  col.fillStyle = SPECIMEN_COLORS.pitcherRimBase;
  col.fillRect(0, 0, s, s);
  bump.fillStyle = SPECIMEN_COLORS.bumpWindow;
  bump.fillRect(0, 0, s, s);
  for (let k = 0; k < 64; k += 1) {
    const x = (k / 64) * s;
    col.fillStyle =
      k % 2 === 0
        ? SPECIMEN_COLORS.pitcherRimLight
        : SPECIMEN_COLORS.pitcherRimDark;
    col.fillRect(x, 0, s / 128, s);
    bump.fillStyle =
      k % 2 === 0 ? SPECIMEN_COLORS.bumpPeak : SPECIMEN_COLORS.bumpDark;
    bump.fillRect(x, 0, s / 128, s);
  }
}

function paintOperculumLid(col: CanvasRenderingContext2D, s: number) {
  const lGrad = col.createLinearGradient(0, 0, 0, s);
  lGrad.addColorStop(0, SPECIMEN_COLORS.pitcherLidBase);
  lGrad.addColorStop(0.5, SPECIMEN_COLORS.pitcherLidMid);
  lGrad.addColorStop(1, SPECIMEN_COLORS.pitcherLidTip);
  col.fillStyle = lGrad;
  col.fillRect(0, 0, s, s);

  for (let i = 0; i < 85; i += 1) {
    const x = valueNoise(i * 3.1, 2.2, 64) * s;
    const y = valueNoise(4.4, i * 2.7, 64) * s;
    col.fillStyle = SPECIMEN_COLORS.pitcherLidFreckle;
    col.beginPath();
    col.arc(x, y, 6 + (i % 9) * 2.2, 0, Math.PI * 2);
    col.fill();
  }

  col.strokeStyle = SPECIMEN_COLORS.pitcherLidVein;
  col.lineWidth = 6;
  col.beginPath();
  col.moveTo(s * 0.5, 0);
  col.lineTo(s * 0.5, s * 0.94);
  col.stroke();

  for (let p = 1; p <= 6; p += 1) {
    const y0 = (p / 7) * s;
    for (const side of [-1, 1] as const) {
      col.lineWidth = 2.6;
      col.beginPath();
      col.moveTo(s * 0.5, y0);
      col.quadraticCurveTo(
        s * 0.5 + side * s * 0.22,
        y0 + 18,
        s * 0.5 + side * s * 0.4,
        y0 + 52
      );
      col.stroke();
    }
  }
}

/**
 * Generates authentic Nepenthes pitcher PBR maps: mottled burgundy-crimson
 * blotches over chartreuse-olive skin, deeply ribbed glossy peristome collar,
 * and veined freckled operculum lid.
 */
export function usePitcherTextures() {
  const maps = useMemo(() => {
    const bodyCol = createBotanicalCanvas(SIZE);
    const bodyBump = createBotanicalCanvas(SIZE);
    const rimCol = createBotanicalCanvas(SIZE);
    const rimBump = createBotanicalCanvas(SIZE);
    const lidCol = createBotanicalCanvas(SIZE);

    if (bodyCol.ctx !== null && bodyBump.ctx !== null) {
      paintPitcherBody(bodyCol.ctx, bodyBump.ctx, SIZE);
    }
    if (rimCol.ctx !== null && rimBump.ctx !== null) {
      paintPeristomeRim(rimCol.ctx, rimBump.ctx, SIZE);
    }
    if (lidCol.ctx !== null) {
      paintOperculumLid(lidCol.ctx, SIZE);
    }

    return {
      bodyBump: finalizeBotanicalTexture(bodyBump.canvas, false, true),
      bodyMap: finalizeBotanicalTexture(bodyCol.canvas, true, true),
      lidMap: finalizeBotanicalTexture(lidCol.canvas, true),
      rimBump: finalizeBotanicalTexture(rimBump.canvas, false, true),
      rimMap: finalizeBotanicalTexture(rimCol.canvas, true, true),
    };
  }, []);

  useEffect(
    () => () => {
      maps.bodyMap.dispose();
      maps.bodyBump.dispose();
      maps.rimMap.dispose();
      maps.rimBump.dispose();
      maps.lidMap.dispose();
    },
    [maps]
  );

  return maps;
}
