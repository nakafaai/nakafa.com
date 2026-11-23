import type { Size } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import {
  isBehindCamera,
  isNearerThanHit,
  objectScale,
  objectZIndex,
  projectToOverlay,
} from "@repo/design-system/components/three/overlay/project";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, MutableHashMap, MutableHashSet, Option } from "effect";
import type { CSSProperties, ReactNode, RefCallback } from "react";
import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Camera, Group, Object3D, Raycaster, Scene } from "three";
import { Vector2, Vector3 } from "three";
import type { StoreApi } from "zustand";
import { createStore, useStore } from "zustand";

/** One label as the overlay draws it: its content, its inner style, and its inner ref. */
interface OverlayItem {
  children: ReactNode;
  id: number;
  ref: RefCallback<HTMLDivElement> | undefined;
  style: CSSProperties | undefined;
  /** Requests a frame of the label's canvas. */
  wake: () => void;
}

interface SceneOverlayState {
  /** Outer element of each label. The frame loop writes these styles, so they are not React state. */
  frames: MutableHashMap.MutableHashMap<number, HTMLElement>;
  /** Labels in mount order, so overlapping labels paint in the order they mounted. */
  items: readonly OverlayItem[];
  /** Label ids that have been projected onto their DOM element at least once. */
  placed: MutableHashSet.MutableHashSet<number>;
  /** Adds a label, or replaces the label with the same id in place. */
  put: (item: OverlayItem) => void;
  remove: (id: number) => void;
}

type SceneOverlayStore = StoreApi<SceneOverlayState>;

function createSceneOverlayStore() {
  const frames = MutableHashMap.empty<number, HTMLElement>();
  const placed = MutableHashSet.empty<number>();
  return createStore<SceneOverlayState>()((set) => ({
    frames,
    items: [],
    placed,
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
      MutableHashSet.remove(placed, id);
      set((state) => ({
        items: Arr.filter(state.items, (known) => known.id !== id),
      }));
    },
  }));
}

const SceneOverlayContext = createContext<SceneOverlayStore | null>(null);

/** Reads the overlay store, which only a SceneOverlayProvider gives. */
function useSceneOverlayStore(): SceneOverlayStore {
  return useRequired(SceneOverlayContext, "useSceneOverlayStore");
}

/** Reads the surrounding overlay store when present, so reveal logic can wait for label attachment. */
export function useSceneOverlayStoreOptional(): SceneOverlayStore | null {
  return use(SceneOverlayContext);
}

/** Whether every registered overlay label has attached its DOM node and been projected at least once. */
export function isSceneOverlayReady(store: SceneOverlayStore): boolean {
  const { frames, items, placed } = store.getState();
  return Arr.every(
    items,
    (item) =>
      MutableHashMap.has(frames, item.id) && MutableHashSet.has(placed, item.id)
  );
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
  const { children, id, ref, style, wake } = item;
  const attachFrame = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      MutableHashMap.set(store.getState().frames, id, element);
      // The element mounts after the frame that registered the label, and a
      // scene that renders on demand has no later frame to place it.
      wake();
      return () => {
        MutableHashMap.remove(store.getState().frames, id);
        MutableHashSet.remove(store.getState().placed, id);
      };
    },
    [id, store, wake]
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

/** Reusable scratch vectors for raycasting without per-frame allocations. */
const RAYCAST_SCREEN = new Vector3();
const RAYCAST_NDC = new Vector2();

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
  RAYCAST_SCREEN.copy(point).project(camera);
  RAYCAST_NDC.set(RAYCAST_SCREEN.x, RAYCAST_SCREEN.y);
  raycaster.setFromCamera(RAYCAST_NDC, camera);
  const nearest = Arr.head(raycaster.intersectObjects([scene], true));
  return isNearerThanHit(
    point.distanceTo(raycaster.ray.origin),
    Option.getOrUndefined(Option.map(nearest, (hit) => hit.distance))
  );
}

function writeOverlayPlacement(
  element: HTMLElement,
  last: {
    visible: boolean;
    x: number;
    y: number;
    zIndex: number;
    zoom: number;
  },
  next: {
    scale: number;
    visible: boolean;
    x: number;
    y: number;
    zIndex: number | undefined;
    zoom: number;
  }
) {
  if (next.visible !== last.visible) {
    element.style.display = next.visible ? "block" : "none";
  }
  if (next.zIndex !== undefined && next.zIndex !== last.zIndex) {
    element.style.zIndex = `${next.zIndex}`;
  }
  element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
  return {
    visible: next.visible,
    x: next.x,
    y: next.y,
    zIndex: next.zIndex ?? last.zIndex,
    zoom: next.zoom,
  };
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
  const placement = useRef({
    visible: true,
    x: 0,
    y: 0,
    zIndex: Number.NaN,
    zoom: 0,
  });
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
    store.getState().put({
      children,
      id: group.id,
      ref,
      style,
      wake: invalidate,
    });
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
    const wasPlaced = MutableHashSet.has(store.getState().placed, group.id);
    // A non-finite x or y fails this test, so only a zoom change writes it, as in drei.
    const last = placement.current;
    const moved =
      !wasPlaced ||
      Math.abs(last.zoom - camera.zoom) > PLACEMENT_TOLERANCE ||
      Math.abs(last.x - x) > PLACEMENT_TOLERANCE ||
      Math.abs(last.y - y) > PLACEMENT_TOLERANCE;
    if (!moved) {
      return;
    }
    const visible =
      !isBehindCamera(point, camera) &&
      (!occlude || isUnobstructed(point, camera, raycaster, scene));
    const zIndex = objectZIndex(point, camera, LABEL_Z_INDEX_RANGE);
    const scale =
      distanceFactor === undefined
        ? 1
        : objectScale(point, camera) * distanceFactor;
    placement.current = writeOverlayPlacement(element, last, {
      scale,
      visible,
      x,
      y,
      zIndex,
      zoom: camera.zoom,
    });
    MutableHashSet.add(store.getState().placed, group.id);
  });

  return <group ref={anchor} />;
}
