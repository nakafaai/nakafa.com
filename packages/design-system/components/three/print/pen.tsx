import type { Pen } from "@repo/design-system/components/three/print/draw";
import { useEffect, useState } from "react";

/** The faces a print uses until the page's own fonts have loaded. */
const FALLBACK = {
  mono: "ui-monospace, monospace",
  sans: "system-ui, sans-serif",
};

/**
 * The typefaces a print is set in: the page's own sans-serif and monospace
 * faces once its fonts have loaded, and the system's before. A canvas draws
 * with whatever face is ready when it draws, so a print that depends on the
 * returned faces is drawn anew when the page's faces arrive, and a reader
 * sees the same letters on a bottle as in the lesson round it.
 */
export function usePrintFaces() {
  const [ready, setReady] = useState(() => document.fonts.status === "loaded");

  useEffect(() => {
    if (ready) {
      return;
    }
    let live = true;
    document.fonts.ready.then(() => {
      if (live) {
        setReady(true);
      }
    });
    return () => {
      live = false;
    };
  }, [ready]);

  if (!ready) {
    return FALLBACK;
  }
  const mono = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  return {
    mono: mono === "" ? FALLBACK.mono : mono,
    sans: getComputedStyle(document.body).fontFamily,
  };
}

/**
 * A pen that draws on a canvas: each stroke of `Pen` as the canvas call it
 * is, with angles turned from counter-clockwise on the object to the
 * canvas's clockwise, y downwards.
 */
export function canvasPen(
  context: CanvasRenderingContext2D,
  faces: ReturnType<typeof usePrintFaces>
): Pen {
  const fontOf = (type: Parameters<Pen["measure"]>[1]) =>
    `${type.weight} ${type.size}px ${faces[type.face]}`;

  return {
    arc: (shape, ink) => {
      context.strokeStyle = ink;
      context.lineWidth = shape.width;
      context.beginPath();
      context.arc(
        shape.x,
        shape.y,
        shape.radius,
        -shape.from,
        -shape.to,
        shape.to > shape.from
      );
      context.stroke();
    },
    band: (shape, ink) => {
      context.fillStyle = ink;
      context.beginPath();
      context.roundRect(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
        shape.radius
      );
      context.fill();
    },
    disc: (shape, ink, strength) => {
      context.globalAlpha = strength;
      context.fillStyle = ink;
      context.beginPath();
      context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    },
    frame: (shape, ink) => {
      context.strokeStyle = ink;
      context.lineWidth = shape.line;
      context.beginPath();
      context.roundRect(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
        shape.radius
      );
      context.stroke();
    },
    line: (shape, ink) => {
      context.strokeStyle = ink;
      context.lineWidth = shape.width;
      context.beginPath();
      context.moveTo(shape.from[0], shape.from[1]);
      context.lineTo(shape.to[0], shape.to[1]);
      context.stroke();
    },
    measure: (text, type) => {
      context.font = fontOf(type);
      return context.measureText(text).width;
    },
    text: (text, place, type, ink) => {
      context.save();
      context.translate(place.x, place.y);
      context.rotate(-place.turn);
      context.font = fontOf(type);
      context.fillStyle = ink;
      context.fillText(text, 0, 0);
      if (place.grow > 0) {
        context.strokeStyle = ink;
        context.lineWidth = place.grow * 2;
        context.lineJoin = "round";
        context.strokeText(text, 0, 0);
      }
      context.restore();
    },
  };
}
