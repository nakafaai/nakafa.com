import {
  useDocumentVisibility,
  useElementSize,
  useMediaQuery,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { useMousePosition } from "@repo/design-system/hooks/use-mouse";
import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { cn } from "cn";
import { Array as Arr, MutableList, Schema } from "effect";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

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
/**
 * Caps the backing store at two device pixels per CSS pixel. A 3x screen would
 * otherwise draw 2.25 times the pixels for little visible gain.
 */
const MAX_CANVAS_PIXEL_RATIO = 2;

/**
 * One particle. The animation loop updates position and alpha in place, so
 * those fields stay mutable.
 */
const CircleSchema = Schema.Struct({
  alpha: Schema.mutableKey(Schema.Finite),
  dx: Schema.Finite,
  dy: Schema.Finite,
  magnetism: Schema.Finite,
  size: Schema.Finite,
  targetAlpha: Schema.Finite,
  translateX: Schema.mutableKey(Schema.Finite),
  translateY: Schema.mutableKey(Schema.Finite),
  x: Schema.mutableKey(Schema.Finite),
  y: Schema.mutableKey(Schema.Finite),
});

type Circle = typeof CircleSchema.Type;

interface ParticlesProps {
  className?: string;
  ease?: number;
  /** Stops the drawing loop while true, and the field holds still. */
  paused?: boolean;
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

/** Maps a value from one range onto another, never below zero. */
function remapValue({
  value,
  start1,
  end1,
  start2,
  end2,
}: RemapValueProps): number {
  const remapped =
    ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
  return remapped > 0 ? remapped : 0;
}

/**
 * Sets a circle's alpha from its nearest canvas edge: it fades in while clear of
 * the edges and dims as it nears them.
 */
function updateAlpha(circle: Circle, width: number, height: number) {
  // Handle the alpha value
  const closestEdge = Math.min(
    circle.x + circle.translateX - circle.size, // distance from left edge
    width - circle.x - circle.translateX - circle.size, // distance from right edge
    circle.y + circle.translateY - circle.size, // distance from top edge
    height - circle.y - circle.translateY - circle.size // distance from bottom edge
  );
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
}

/** Reports whether a circle has left the canvas, its radius included. */
function isOutsideCanvas(circle: Circle, width: number, height: number) {
  return (
    circle.x < -circle.size ||
    circle.x > width + circle.size ||
    circle.y < -circle.size ||
    circle.y > height + circle.size
  );
}

/**
 * Renders the responsive particle canvas used as a subtle interactive backdrop.
 */
export function Particles({
  className = "",
  paused = false,
  quantity = 50,
  staticity = 100,
  ease = 100,
}: ParticlesProps) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // The observer reports the container's size, so the field follows its parent.
  const {
    ref: containerSizeRef,
    width,
    height,
  } = useElementSize<HTMLDivElement>();
  const containerRef = useMergedRef(canvasContainerRef, containerSizeRef);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mousePositionRef = useMousePosition();
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const dpr =
    typeof window === "undefined"
      ? 1
      : Math.min(window.devicePixelRatio, MAX_CANVAS_PIXEL_RATIO);

  const documentVisibility = useDocumentVisibility();
  const isMobile = useMediaQuery(TAILWIND_MEDIA_QUERIES.belowMd);
  const shouldReduceMotion = useReducedMotion(undefined, {
    getInitialValueInEffect: false,
  });

  const rng = useStableMutableValue(() =>
    createSeededRandom(quantity, staticity, ease)
  );

  const isThemeDark = useMemo(
    () => getThemeAppearance(resolvedTheme) === "dark",
    [resolvedTheme]
  );

  // A new size keeps every particle where it was, in proportion to the field, so
  // a resize or a rotation moves the field instead of drawing it anew.
  const resizeCanvas = useCallback(() => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      const previousWidth = canvasSize.current.w;
      const previousHeight = canvasSize.current.h;
      canvasSize.current.w = canvasContainerRef.current.offsetWidth;
      canvasSize.current.h = canvasContainerRef.current.offsetHeight;
      canvasRef.current.width = canvasSize.current.w * dpr;
      canvasRef.current.height = canvasSize.current.h * dpr;
      canvasRef.current.style.width = `${canvasSize.current.w}px`;
      canvasRef.current.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
      if (previousWidth > 0 && previousHeight > 0) {
        for (const circle of circles.current) {
          circle.x = (circle.x * canvasSize.current.w) / previousWidth;
          circle.y = (circle.y * canvasSize.current.h) / previousHeight;
        }
      }
    }
  }, [dpr]);

  const circleParams = useCallback((): Circle => {
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
  }, [rng]);

  // Every circle of a frame shares one colour; each circle sets only its alpha.
  const fillColor = isThemeDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)";

  const drawCircle = useCallback(
    (circle: Circle) => {
      if (context.current) {
        const { x, y, translateX, translateY, size, alpha } = circle;
        context.current.translate(translateX, translateY);
        context.current.beginPath();
        context.current.arc(x, y, size, 0, 2 * Math.PI);
        context.current.globalAlpha = alpha;
        context.current.fill();
        context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    },
    [dpr]
  );

  const clearContext = useCallback(() => {
    if (context.current) {
      context.current.clearRect(
        0,
        0,
        canvasSize.current.w,
        canvasSize.current.h
      );
      context.current.fillStyle = fillColor;
    }
  }, [fillColor]);

  const drawParticles = useCallback(
    (showImmediately: boolean) => {
      clearContext();
      const particles = MutableList.make<Circle>();
      const particleCount = quantity;
      for (let i = 0; i < particleCount; i += 1) {
        const circle = circleParams();
        if (showImmediately) {
          circle.alpha = circle.targetAlpha;
        }
        drawCircle(circle);
        MutableList.append(particles, circle);
      }
      // The list keeps the new circles only where a canvas context draws them.
      if (context.current) {
        circles.current = Arr.appendAll(
          circles.current,
          MutableList.toArray(particles)
        );
      }
    },
    [circleParams, clearContext, drawCircle, quantity]
  );

  // The first size draws the field; a later one redraws the particles it has.
  const initCanvas = useCallback(
    (showImmediately: boolean) => {
      resizeCanvas();
      if (circles.current.length === 0) {
        drawParticles(showImmediately);
        return;
      }
      clearContext();
      for (const circle of circles.current) {
        drawCircle(circle);
      }
    },
    [clearContext, drawCircle, drawParticles, resizeCanvas]
  );

  const onMouseMove = useCallback(() => {
    if (canvasRef.current) {
      // Read per frame: layout can move the canvas without a scroll or resize
      // event, and the frame writes no DOM, so this read stays cheap.
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

  const animate = useCallback(() => {
    onMouseMove();
    clearContext();
    // The frame visits the circles in the order the in-place loop did: a circle
    // that leaves the canvas is replaced at the end, and the circle that slides
    // into its slot is passed over for this frame. A queue replays that order.
    const queue = MutableList.make<Circle>();
    MutableList.appendAll(queue, circles.current);
    const passed = MutableList.make<Circle>();
    const visits = circles.current.length;
    for (let visit = 0; visit < visits; visit += 1) {
      const circle = MutableList.take(queue);
      if (circle === MutableList.Empty) {
        break;
      }
      updateAlpha(circle, canvasSize.current.w, canvasSize.current.h);
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
      if (isOutsideCanvas(circle, canvasSize.current.w, canvasSize.current.h)) {
        // the circle leaves the list and a new one joins at the end
        const newCircle = circleParams();
        drawCircle(newCircle);
        MutableList.append(queue, newCircle);
        // the circle that slides into the freed slot is passed over this frame
        const slid = MutableList.take(queue);
        if (slid !== MutableList.Empty) {
          MutableList.append(passed, slid);
        }
      } else {
        MutableList.append(passed, circle);
        drawCircle(circle);
      }
    }
    circles.current = Arr.appendAll(
      MutableList.toArray(passed),
      MutableList.toArray(queue)
    );
    animationFrameRef.current = window.requestAnimationFrame(animate);
  }, [
    circleParams,
    clearContext,
    drawCircle,
    ease,
    staticity,
    isMobile,
    onMouseMove,
  ]);

  const startAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animate();
  }, [animate]);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext("2d");
    }

    return stopAnimation;
  }, [stopAnimation]);

  // The field draws once the observer has measured the container, then again
  // each time the container changes size. A zero box is not laid out yet.
  useLayoutEffect(() => {
    if (width === 0 && height === 0) {
      return;
    }
    initCanvas(shouldReduceMotion);
  }, [height, initCanvas, shouldReduceMotion, width]);

  useEffect(() => {
    const isDocumentVisible =
      documentVisibility === "visible" &&
      document.visibilityState === "visible";

    if (!isDocumentVisible || shouldReduceMotion || paused) {
      stopAnimation();
      return;
    }

    startAnimation();

    return stopAnimation;
  }, [
    documentVisibility,
    paused,
    shouldReduceMotion,
    startAnimation,
    stopAnimation,
  ]);

  return (
    <div aria-hidden="true" className={cn(className)} ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
