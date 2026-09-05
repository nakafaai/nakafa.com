"use client";

import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import type {
  CameraLabelBounds,
  CameraMotionBounds,
  CameraSubjectBounds,
} from "@repo/design-system/lib/geometry/camera/bounds";
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Box3, type Group, type Object3D, Vector3 } from "three";

function createFraming() {
  const listeners = new Set<() => void>();
  const labels = new Map<Object3D, CameraLabelBounds>();
  const subjects = new Map<Object3D, CameraSubjectBounds>();
  let scheduled: number | undefined;
  let renderedChildren: ReactNode;
  const invalidate = () => {
    if (scheduled !== undefined) {
      return;
    }
    scheduled = requestAnimationFrame(() => {
      scheduled = undefined;
      for (const listener of listeners) {
        listener();
      }
    });
  };

  return {
    labels,
    subjects,
    commit(children: ReactNode) {
      if (renderedChildren === children) {
        return;
      }
      renderedChildren = children;
      invalidate();
    },
    cancel() {
      if (scheduled !== undefined) {
        cancelAnimationFrame(scheduled);
        scheduled = undefined;
      }
    },
    invalidate,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const FramingContext = createContext<ReturnType<typeof createFraming> | null>(
  null
);

/** Each canvas has one registry, with work coalesced after discrete React updates. */
export function CameraFraming({ children }: { children: ReactNode }) {
  const [framing] = useState(createFraming);
  useLayoutEffect(() => {
    framing.commit(children);
  }, [children, framing]);
  useLayoutEffect(() => () => framing.cancel(), [framing]);

  return <FramingContext value={framing}>{children}</FramingContext>;
}

/** React boundary shared by camera controls, finite subjects, and HTML labels. */
export function useCameraFraming() {
  return use(FramingContext);
}

/**
 * Declares a stable local animation envelope or excludes scene decoration.
 * Geometry inside a finite envelope never makes the camera chase animation.
 */
export function CameraBounds({
  bounds,
  children,
  exclude = false,
  motion,
  objectRef,
}: {
  bounds?: CoordinateFrame;
  children: ReactNode;
  exclude?: boolean;
  motion?: CameraMotionBounds;
  objectRef?: RefObject<Group | null>;
}) {
  const framing = useCameraFraming();
  const ownedGroup = useRef<Group>(null);
  const group = objectRef ?? ownedGroup;
  const minX = bounds?.x.min;
  const minY = bounds?.y.min;
  const minZ = bounds?.z.min;
  const maxX = bounds?.x.max;
  const maxY = bounds?.y.max;
  const maxZ = bounds?.z.max;
  const rotation = motion?.rotation;
  const scale = motion?.scale;
  const travelMinX = motion?.translation?.x.min;
  const travelMinY = motion?.translation?.y.min;
  const travelMinZ = motion?.translation?.z.min;
  const travelMaxX = motion?.translation?.x.max;
  const travelMaxY = motion?.translation?.y.max;
  const travelMaxZ = motion?.translation?.z.max;

  useLayoutEffect(() => {
    const object = group.current;
    if (!(framing && object)) {
      return;
    }
    if (exclude) {
      framing.subjects.set(object, false);
    } else if (
      rotation !== undefined ||
      scale !== undefined ||
      travelMinX !== undefined
    ) {
      const translation =
        travelMinX !== undefined &&
        travelMinY !== undefined &&
        travelMinZ !== undefined &&
        travelMaxX !== undefined &&
        travelMaxY !== undefined &&
        travelMaxZ !== undefined
          ? {
              x: { min: travelMinX, max: travelMaxX },
              y: { min: travelMinY, max: travelMaxY },
              z: { min: travelMinZ, max: travelMaxZ },
            }
          : undefined;
      framing.subjects.set(object, { rotation, scale, translation });
    } else if (
      minX !== undefined &&
      minY !== undefined &&
      minZ !== undefined &&
      maxX !== undefined &&
      maxY !== undefined &&
      maxZ !== undefined
    ) {
      framing.subjects.set(
        object,
        new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ))
      );
    }
    framing.invalidate();
    return () => {
      framing.subjects.delete(object);
      framing.invalidate();
    };
  }, [
    exclude,
    framing,
    group,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    rotation,
    scale,
    travelMinX,
    travelMinY,
    travelMinZ,
    travelMaxX,
    travelMaxY,
    travelMaxZ,
  ]);

  return <group ref={group}>{children}</group>;
}
