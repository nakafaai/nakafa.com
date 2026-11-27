import {
  createBotanicalCanvas,
  finalizeBotanicalTexture,
} from "@repo/design-system/components/contents/biology/foliage";
import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { useEffect, useMemo } from "react";

function paintCaterpillarBands(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D
) {
  const segW = 512 / 11;
  for (let seg = 0; seg < 11; seg += 1) {
    const x0 = seg * segW;
    col.fillStyle = SPECIMEN_COLORS.caterpillarYellow;
    col.fillRect(x0, 0, segW * 0.34, 256);
    col.fillStyle = SPECIMEN_COLORS.caterpillarBlack;
    col.fillRect(x0 + segW * 0.34, 0, segW * 0.22, 256);
    col.fillStyle = SPECIMEN_COLORS.caterpillarCream;
    col.fillRect(x0 + segW * 0.56, 0, segW * 0.24, 256);
    col.fillStyle = SPECIMEN_COLORS.caterpillarDark;
    col.fillRect(x0 + segW * 0.8, 0, segW * 0.2, 256);

    bump.fillStyle = SPECIMEN_COLORS.bumpDeep;
    bump.fillRect(x0, 0, 4, 256);
    bump.fillStyle = SPECIMEN_COLORS.bumpRaised;
    bump.fillRect(x0 + segW * 0.45, 0, segW * 0.22, 256);
  }
}

function paintGrasshopperCuticle(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D
) {
  const grad = col.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SPECIMEN_COLORS.ghBase);
  grad.addColorStop(0.5, SPECIMEN_COLORS.ghMid);
  grad.addColorStop(1, SPECIMEN_COLORS.ghLight);
  col.fillStyle = grad;
  col.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 180; i += 1) {
    const sx = valueNoise(i * 2.3, 4.1, 64) * 512;
    const sy = valueNoise(1.9, i * 3.1, 64) * 256;
    col.fillStyle =
      i % 2 === 0
        ? SPECIMEN_COLORS.ghMottleDark
        : SPECIMEN_COLORS.ghMottleLight;
    col.beginPath();
    col.arc(sx, sy, 4 + (i % 6) * 2, 0, Math.PI * 2);
    col.fill();
  }

  for (let seg = 1; seg < 10; seg += 1) {
    const sx = (seg / 10) * 512;
    col.strokeStyle = SPECIMEN_COLORS.ghCrease;
    col.lineWidth = 3;
    col.beginPath();
    col.moveTo(sx, 0);
    col.lineTo(sx, 256);
    col.stroke();
    bump.fillStyle = SPECIMEN_COLORS.bumpGroove;
    bump.fillRect(sx - 2, 0, 4, 256);
  }
}

/**
 * Generates cuticle PBR textures for monarch caterpillar (yellow, cream,
 * and velvet-black transverse bands + intersegmental crease shading) or
 * olive-green mottled grasshopper nymph/adult exoskeleton.
 */
export function useCuticleTextures(insect: Insect) {
  const maps = useMemo(() => {
    const col = createBotanicalCanvas(512);
    const bump = createBotanicalCanvas(512);
    col.canvas.height = 256;
    bump.canvas.height = 256;

    if (col.ctx !== null && bump.ctx !== null) {
      bump.ctx.fillStyle = SPECIMEN_COLORS.bumpMidSoft;
      bump.ctx.fillRect(0, 0, 512, 256);
      if (insect === "butterfly") {
        paintCaterpillarBands(col.ctx, bump.ctx);
      } else {
        paintGrasshopperCuticle(col.ctx, bump.ctx);
      }
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false),
      map: finalizeBotanicalTexture(col.canvas, true),
    };
  }, [insect]);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
    },
    [maps]
  );

  return maps;
}
