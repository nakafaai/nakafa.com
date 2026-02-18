"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useMousePosition } from "@repo/design-system/hooks/use-mouse";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { cn } from "@repo/design-system/lib/utils";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";

const MIN_PARTICLE_SIZE = 1;
const MAX_PARTICLE_SIZE = 3;
const MIN_TARGET_ALPHA = 0.1;
const MAX_TARGET_ALPHA = 0.7;
const MIN_PARTICLE_SPEED = -0.1;
const MAX_PARTICLE_SPEED = 0.1;
const MIN_MAGNETISM = 0.1;
const MAX_MAGNETISM = 4.1;
const REMAP_EDGE_END = 20;
const ALPHA_FADE_IN_SPEED = 0.02;

interface Circle {
  alpha: number;
  dx: number;
  dy: number;
  magnetism: number;
  size: number;
  targetAlpha: number;
  translateX: number;
  translateY: number;
  x: number;
  y: number;
}

interface ParticlesProps {
  className?: string;
  ease?: number;
  quantity?: number;
  staticity?: number;
}

interface RemapValueProps {
  end1: number;
  end2: number;
  start1: number;
  start2: number;
  value: number;
}

function ParticlesComponent({
  className = "",
  quantity = 50,
  staticity = 100,
  ease = 100,
}: ParticlesProps) {
  const { resolvedTheme } = useTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mousePositionRef = useMousePosition();
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  const isMobile = useMediaQuery("(max-width: 768px)");

  const rngRef = useRef(createSeededRandom(quantity, staticity, ease));

  const isThemeDark = useMemo(() => {
    if (!resolvedTheme) {
      return false;
    }
    return resolvedTheme === "dark";
  }, [resolvedTheme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to call initCanvas and animate on mount
  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d");
    }
    initCanvas();
    animate();
    window.addEventListener("resize", initCanvas);

    return () => {
      window.removeEventListener("resize", initCanvas);
    };
  }, []);

  // when color changes, we need to re-render the particles
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to call initCanvas and animate on mount
  useEffect(() => {
    if (resolvedTheme) {
      initCanvas();
      animate();
    }
  }, [resolvedTheme]);

  const resizeCanvas = useCallback(() => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      circles.current.length = 0;
      canvasSize.current.w = canvasContainerRef.current.offsetWidth;
      canvasSize.current.h = canvasContainerRef.current.offsetHeight;
      canvasRef.current.width = canvasSize.current.w * dpr;
      canvasRef.current.height = canvasSize.current.h * dpr;
      canvasRef.current.style.width = `${canvasSize.current.w}px`;
      canvasRef.current.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
    }
  }, [dpr]);

  const circleParams = useCallback((): Circle => {
    const rng = rngRef.current;
    const x = Math.floor(rng.next() * canvasSize.current.w);
    const y = Math.floor(rng.next() * canvasSize.current.h);
    const translateX = 0;
    const translateY = 0;
    const size = rng.nextInt(MIN_PARTICLE_SIZE, MAX_PARTICLE_SIZE);
    const alpha = 0;
    const targetAlpha = Number.parseFloat(
      rng.nextFloat(MIN_TARGET_ALPHA, MAX_TARGET_ALPHA).toFixed(1)
    );
    const dx = rng.nextFloat(MIN_PARTICLE_SPEED, MAX_PARTICLE_SPEED);
    const dy = rng.nextFloat(MIN_PARTICLE_SPEED, MAX_PARTICLE_SPEED);
    const magnetism = rng.nextFloat(MIN_MAGNETISM, MAX_MAGNETISM);
    return {
      x,
      y,
      translateX,
      translateY,
      size,
      alpha,
      targetAlpha,
      dx,
      dy,
      magnetism,
    };
  }, []);

  const drawCircle = useCallback(
    (circle: Circle, update = false) => {
      if (context.current) {
        const { x, y, translateX, translateY, size, alpha } = circle;
        context.current.translate(translateX, translateY);
        context.current.beginPath();
        context.current.arc(x, y, size, 0, 2 * Math.PI);
        context.current.fillStyle = isThemeDark
          ? `oklch(0.985 0 0 / ${alpha})`
          : `oklch(0.145 0 0 / ${alpha})`;
        context.current.fill();
        context.current.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!update) {
          circles.current.push(circle);
        }
      }
    },
    [dpr, isThemeDark]
  );

  const clearContext = useCallback(() => {
    if (context.current) {
      context.current.clearRect(
        0,
        0,
        canvasSize.current.w,
        canvasSize.current.h
      );
    }
  }, []);

  const drawParticles = useCallback(() => {
    clearContext();
    const particleCount = quantity;
    for (let i = 0; i < particleCount; i += 1) {
      const circle = circleParams();
      drawCircle(circle);
    }
  }, [circleParams, clearContext, drawCircle, quantity]);

  const initCanvas = useCallback(() => {
    resizeCanvas();
    drawParticles();
  }, [drawParticles, resizeCanvas]);

  const onMouseMove = useCallback(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = mousePositionRef.current.x - rect.left - w / 2;
      const y = mousePositionRef.current.y - rect.top - h / 2;
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
      if (inside) {
        mouse.current.x = x;
        mouse.current.y = y;
      }
    }
  }, [mousePositionRef]);

  useEffect(() => {
    // Set up a continuous update for mouse position
    let animationId: number;

    const updateMousePosition = () => {
      onMouseMove();
      animationId = requestAnimationFrame(updateMousePosition);
    };

    updateMousePosition();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [onMouseMove]);

  const remapValue = useCallback(
    ({ value, start1, end1, start2, end2 }: RemapValueProps): number => {
      const remapped =
        ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
      return remapped > 0 ? remapped : 0;
    },
    []
  );

  const animate = useCallback(() => {
    clearContext();
    circles.current.forEach((circle: Circle, i: number) => {
      // Handle the alpha value
      const edge = [
        circle.x + circle.translateX - circle.size, // distance from left edge
        canvasSize.current.w - circle.x - circle.translateX - circle.size, // distance from right edge
        circle.y + circle.translateY - circle.size, // distance from top edge
        canvasSize.current.h - circle.y - circle.translateY - circle.size, // distance from bottom edge
      ];
      const closestEdge = edge.reduce((a, b) => Math.min(a, b));
      const remapClosestEdge = Number.parseFloat(
        remapValue({
          value: closestEdge,
          start1: 0,
          end1: REMAP_EDGE_END,
          start2: 0,
          end2: 1,
        }).toFixed(2)
      );
      if (remapClosestEdge > 1) {
        circle.alpha += ALPHA_FADE_IN_SPEED;
        if (circle.alpha > circle.targetAlpha) {
          circle.alpha = circle.targetAlpha;
        }
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge;
      }
      circle.x += circle.dx;
      circle.y += circle.dy;

      // Only apply mouse-based movement on non-mobile devices
      if (isMobile) {
        // On mobile, gradually reset any existing translation to zero
        circle.translateX += -circle.translateX / ease;
        circle.translateY += -circle.translateY / ease;
      } else {
        circle.translateX +=
          (mouse.current.x / (staticity / circle.magnetism) -
            circle.translateX) /
          ease;
        circle.translateY +=
          (mouse.current.y / (staticity / circle.magnetism) -
            circle.translateY) /
          ease;
      }

      // circle gets out of the canvas
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        // remove the circle from the array
        circles.current.splice(i, 1);
        // create a new circle
        const newCircle = circleParams();
        drawCircle(newCircle);
        // update the circle position
      } else {
        drawCircle(
          {
            ...circle,
            x: circle.x,
            y: circle.y,
            translateX: circle.translateX,
            translateY: circle.translateY,
            alpha: circle.alpha,
          },
          true
        );
      }
    });
    window.requestAnimationFrame(animate);
  }, [
    circleParams,
    clearContext,
    drawCircle,
    ease,
    remapValue,
    staticity,
    isMobile,
  ]);

  return (
    <div aria-hidden="true" className={cn(className)} ref={canvasContainerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export const Particles = dynamic(() => Promise.resolve(ParticlesComponent), {
  ssr: false,
});
