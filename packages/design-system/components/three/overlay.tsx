"use client";

import type { Size } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import {
  isBehindCamera,
  isNearerThanHit,
  objectScale,
  objectZIndex,
  projectToOverlay,
} from "@repo/design-system/components/three/overlay/project";
import { Array as Arr, MutableHashMap, Option } from "effect";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type RefCallback,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Camera, Group, Object3D, Raycaster, Scene } from "three";
import { Vector2, Vector3 } from "three";
import { createStore, type StoreApi, useStore } from "zustand";

/** One label as the overlay draws it: its content, its inner style, and its inner ref. */
interface OverlayItem {
  children: ReactNode;
  id: number;
  ref: RefCallback<HTMLDivElement> | undefined;
  style: CSSProperties | undefined;
}

interface SceneOverlayState {
  /** Outer element of each label. The frame loop writes these styles, so they are not React state. */
  frames: MutableHashMap.MutableHashMap<number, HTMLElement>;
  /** Labels in mount order, so overlapping labels paint in the order they mounted. */
  items: readonly OverlayItem[];
  /** Adds a label, or replaces the label with the same id in place. */
  put: (item: OverlayItem) => void;
  remove: (id: number) => void;
}

type SceneOverlayStore = StoreApi<SceneOverlayState>;

function createSceneOverlayStore() {
  const frames = MutableHashMap.empty<number, HTMLElement>();
  return createStore<SceneOverlayState>()((set) => ({
    frames,
    items: [],
    put(item) {
      set((state) => ({
        items: Arr.some(state.items, (known) => known.id === item.id)
          ? Arr.map(state.items, (known) =>
              known.id === item.id ? item : known
            )
          : Arr.append(state.items, item),
      }));
    },
    remove(id) {
      set((state) => ({
        items: Arr.filter(state.items, (known) => known.id !== id),
      }));
    },
  }));
}

const SceneOverlayContext = createContext<SceneOverlayStore | null>(null);

/** Reads the overlay store, which only a SceneOverlayProvider gives. */
function useSceneOverlayStore(): SceneOverlayStore {
  const store = use(SceneOverlayContext);
  if (store === null) {
    throw new Error("Scene labels must render inside a SceneOverlayProvider.");
  }
  return store;
}

/**
 * Holds the labels of one canvas. It wraps the canvas and the overlay, so a
 * label rendered inside the canvas can register its content with the overlay.
 */
export function SceneOverlayProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSceneOverlayStore);
  return <SceneOverlayContext value={store}>{children}</SceneOverlayContext>;
}

/** One label: an outer element that the frame loop moves, and an inner element that holds its content. */
function OverlayLabel({ item }: { item: OverlayItem }) {
  const store = useSceneOverlayStore();
  const { children, id, ref, style } = item;
  const attachFrame = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      MutableHashMap.set(store.getState().frames, id, element);
      return () => {
        MutableHashMap.remove(store.getState().frames, id);
      };
    },
    [id, store]
  );

  return (
    <div
      ref={attachFrame}
      style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0" }}
    >
      <div ref={ref} style={{ position: "absolute", ...style }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Draws every registered label above the canvas. The container and each label
 * ignore the pointer, so the canvas keeps every press. The container fills the
 * frame that holds the canvas, which must therefore be positioned.
 */
export function SceneOverlay() {
  const store = useSceneOverlayStore();
  const items = useStore(store, (state) => state.items);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {Arr.map(items, (item) => (
        <OverlayLabel item={item} key={item.id} />
      ))}
    </div>
  );
}

/** Z-index range of a label, from the near plane to the far plane. */
const LABEL_Z_INDEX_RANGE = [1, 0] as const;

/** A change this small, in pixels or in zoom, is not written. drei uses the same tolerance. */
const PLACEMENT_TOLERANCE = 0.001;

interface SceneHtmlProps {
  /** Places the label from its anchor and the camera, with the signature of drei's calculatePosition. */
  calculatePosition?:
    | ((
        anchor: Object3D,
        camera: Camera,
        size: Size
      ) => readonly [number, number])
    | undefined;
  children?: ReactNode;
  /** Scales the label with its distance from the camera, as drei's distanceFactor does. */
  distanceFactor?: number | undefined;
  /** Hides the label while an object of the scene stands between the camera and the label. */
  occlude?: boolean | undefined;
  /** Receives the inner element and may return a cleanup, as a React ref does. */
  ref?: RefCallback<HTMLDivElement> | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Whether the camera ray through a point reaches the point before any object of
 * the scene does. The ray runs from the camera through the point's screen
 * position, as drei's occlusion test does for `occlude`.
 */
function isUnobstructed(
  point: Vector3,
  camera: Camera,
  raycaster: Raycaster,
  scene: Scene
): boolean {
  const screen = new Vector3().copy(point).project(camera);
  raycaster.setFromCamera(new Vector2(screen.x, screen.y), camera);
  const nearest = Arr.head(raycaster.intersectObjects([scene], true));
  return isNearerThanHit(
    point.distanceTo(raycaster.ray.origin),
    Option.getOrUndefined(Option.map(nearest, (hit) => hit.distance))
  );
}

/**
 * Places DOM content at a point of the scene. It replaces drei's Html, which
 * mounted a second React root for every label. The content renders in
 * SceneOverlay, outside the canvas. This component registers the content, and
 * its frame writes the outer element with the formulas of drei's non-transform
 * branch, including drei's rule for when a placement is written.
 */
export function SceneHtml({
  calculatePosition,
  children,
  distanceFactor,
  occlude,
  ref,
  style,
}: SceneHtmlProps) {
  const store = useSceneOverlayStore();
  const invalidate = useThree((state) => state.invalidate);
  const anchor = useRef<Group>(null);
  // The placement the frame loop last wrote. drei caches the same four values.
  const placement = useRef({ visible: true, x: 0, y: 0, zoom: 0 });
  const point = useMemo(() => new Vector3(), []);

  // Unmounting removes the label. Updates below replace it in place, so a
  // label that changes keeps its place in the paint order.
  useLayoutEffect(() => {
    const group = anchor.current;
    return () => {
      if (group) {
        store.getState().remove(group.id);
      }
    };
  }, [store]);

  useLayoutEffect(() => {
    const group = anchor.current;
    if (!group) {
      return;
    }
    store.getState().put({ children, id: group.id, ref, style });
    invalidate();
  }, [children, invalidate, ref, store, style]);

  // Runs at the default priority, after the frame of a label that sets its
  // anchor's position at a negative priority.
  useFrame(({ camera, raycaster, scene, size }) => {
    const group = anchor.current;
    if (!group) {
      return;
    }
    const element = Option.getOrUndefined(
      MutableHashMap.get(store.getState().frames, group.id)
    );
    if (!element) {
      return;
    }
    camera.updateMatrixWorld();
    group.getWorldPosition(point);
    const [x, y] = calculatePosition
      ? calculatePosition(group, camera, size)
      : projectToOverlay(point, camera, size);
    // A non-finite x or y fails this test, so only a zoom change writes it, as in drei.
    const last = placement.current;
    const moved =
      Math.abs(last.zoom - camera.zoom) > PLACEMENT_TOLERANCE ||
      Math.abs(last.x - x) > PLACEMENT_TOLERANCE ||
      Math.abs(last.y - y) > PLACEMENT_TOLERANCE;
    if (!moved) {
      return;
    }
    const visible =
      !isBehindCamera(point, camera) &&
      (!occlude || isUnobstructed(point, camera, raycaster, scene));
    if (visible !== last.visible) {
      element.style.display = visible ? "block" : "none";
    }
    const zIndex = objectZIndex(point, camera, LABEL_Z_INDEX_RANGE);
    if (zIndex !== undefined) {
      element.style.zIndex = `${zIndex}`;
    }
    const scale =
      distanceFactor === undefined
        ? 1
        : objectScale(point, camera) * distanceFactor;
    element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    placement.current = { visible, x, y, zoom: camera.zoom };
  });

  return <group ref={anchor} />;
}
