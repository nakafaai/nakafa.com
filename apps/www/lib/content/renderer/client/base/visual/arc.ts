import { BigDecimal } from "effect";

import type { ResolvedPlaneObject } from "@/lib/content/renderer/client/base/visual/geometry";
import {
  type PlaneViewport,
  projectExactPlanePoint,
  projectPlaneRadius,
} from "@/lib/content/renderer/client/base/visual/projection";

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function coordinate(value: BigDecimal.BigDecimal) {
  const numeric = BigDecimal.toNumberUnsafe(value);
  return Number.isFinite(numeric) ? `${numeric}` : BigDecimal.format(value);
}

function unitVector(degrees: number) {
  const canonical = ((degrees % 360) + 360) % 360;
  if (canonical === 0) {
    return { x: 1, y: 0 };
  }
  if (canonical === 90) {
    return { x: 0, y: 1 };
  }
  if (canonical === 180) {
    return { x: -1, y: 0 };
  }
  if (canonical === 270) {
    return { x: 0, y: -1 };
  }
  const radians = (canonical * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

/** Creates one directed circular SVG arc with the authored sweep semantics. */
export function createPlaneArc(
  object: Extract<ResolvedPlaneObject, { readonly kind: "arc" }>,
  viewport: PlaneViewport
) {
  const start = unitVector(object.startDegrees);
  const end = unitVector(object.startDegrees + object.sweepDegrees);
  const point = ({ x, y }: { readonly x: number; readonly y: number }) =>
    projectExactPlanePoint(
      {
        x: BigDecimal.sum(
          decimal(object.center.x),
          BigDecimal.multiply(decimal(object.radius), decimal(x))
        ),
        y: BigDecimal.sum(
          decimal(object.center.y),
          BigDecimal.multiply(decimal(object.radius), decimal(y))
        ),
      },
      viewport
    );
  const from = point(start);
  const to = point(end);
  const radius = projectPlaneRadius(object.radius, viewport);
  const largeArc = Math.abs(object.sweepDegrees) > 180 ? 1 : 0;
  const sweep = object.sweepDegrees > 0 ? 0 : 1;

  return `M ${coordinate(from.x)} ${coordinate(from.y)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${coordinate(to.x)} ${coordinate(to.y)}`;
}
