"use client";

import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import type {
  CameraLabelBounds,
  CameraMotionBounds,
  CameraSubjectBounds,
} from "@repo/design-system/lib/geometry/camera/bounds";
import { MutableHashMap, MutableHashSet } from "effect";
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Box3, type Group, Vector3 } from "three";

function createFraming() {
  const listeners = MutableHashSet.empty<() => void>();
  // Effect hashes object keys structurally, which would walk a whole scene
  // graph, so each registry keys an object by its id.
  const labels = MutableHashMap.empty<number, CameraLabelBounds>();
  const subjects = MutableHashMap.empty<number, CameraSubjectBounds>();
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
      MutableHashSet.add(listeners, listener);
      return () => {
        MutableHashSet.remove(listeners, listener);
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
  bounds?: CoordinateFrame | undefined;
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
      MutableHashMap.set(framing.subjects, object.id, false);
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
      MutableHashMap.set(framing.subjects, object.id, {
        rotation,
        scale,
        translation,
      });
    } else if (
      minX !== undefined &&
      minY !== undefined &&
      minZ !== undefined &&
      maxX !== undefined &&
      maxY !== undefined &&
      maxZ !== undefined
    ) {
      MutableHashMap.set(
        framing.subjects,
        object.id,
        new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ))
      );
    }
    framing.invalidate();
    return () => {
      MutableHashMap.remove(framing.subjects, object.id);
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
