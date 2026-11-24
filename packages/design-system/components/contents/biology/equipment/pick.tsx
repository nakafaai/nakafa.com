import { useThree } from "@react-three/fiber";
import type { Equipment } from "@repo/design-system/components/contents/biology/equipment/places";
import { isEquipment } from "@repo/design-system/components/contents/biology/equipment/places";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { createContext, useEffect, useMemo } from "react";
import type { Object3D } from "three";
import { Raycaster, Vector2 } from "three";

/** What the laboratory corner's parts read about the learner's pick. */
interface PickValue {
  /** The item picked now. */
  readonly current: Equipment;
  /** The items the learner may pick, in the lesson's order. */
  readonly items: readonly [Equipment, ...Equipment[]];
  /** The picked item's name, which its label shows, when the lesson gives one. */
  readonly name: string | undefined;
  /** Picks an item, which turns the camera to it even when it is picked already. */
  readonly pick: (item: Equipment) => void;
  /** How many picks the learner has made, so a second pick of one item turns the camera again. */
  readonly visit: number;
}

const PickContext = createContext<PickValue | null>(null);

/** Gives the laboratory corner's parts the learner's pick and the action that changes it. */
export function PickProvider({
  children,
  current,
  items,
  name,
  pick,
  visit,
}: PickValue & { readonly children: ReactNode }) {
  const value = useMemo(
    () => ({ current, items, name, pick, visit }),
    [current, items, name, pick, visit]
  );
  return <PickContext value={value}>{children}</PickContext>;
}

/** Reads the learner's pick in the laboratory corner. */
export function usePick() {
  return useRequired(PickContext, "usePick");
}

/** How far a pointer may travel between press and release, in pixels, and still count as a click rather than an orbit. */
const CLICK_TRAVEL = 4;

/**
 * Tags one item of the corner as pickable, when the lesson lets the learner
 * pick it. An item the lesson does not list stays part of the room. The
 * card's selects pick the same items from the keyboard.
 */
export function Pick({
  children,
  item,
}: {
  readonly children: ReactNode;
  readonly item: Equipment;
}) {
  const { items } = usePick();
  if (!Arr.contains(items, item)) {
    return children;
  }
  return <group userData={{ pick: item }}>{children}</group>;
}

/** The item a part of the scene belongs to: the tag of the nearest pickable group it stands in. */
function itemOf(object: Object3D | null): Equipment | undefined {
  if (object === null) {
    return undefined;
  }
  const tag: unknown = object.userData.pick;
  return isEquipment(tag) ? tag : itemOf(object.parent);
}

/**
 * Picks the item under the pointer: a press and release that barely moves
 * picks the nearest thing the ray from the camera meets, when that thing is
 * a pickable item, and the pointer shows a hand over one. A press that drags
 * orbits the camera instead. The scene's parts take no pointer handlers of
 * their own, so one ray per press serves the whole corner.
 */
export function Picker() {
  const { pick } = usePick();
  const canvas = useThree((state) => state.gl.domElement);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const ray = new Raycaster();
    const pointer = new Vector2();
    const pressed = new Vector2();
    const under = (event: PointerEvent) => {
      const frame = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - frame.left) / frame.width) * 2 - 1,
        -((event.clientY - frame.top) / frame.height) * 2 + 1
      );
      ray.setFromCamera(pointer, camera);
      return Option.match(Arr.head(ray.intersectObject(scene, true)), {
        onNone: () => undefined,
        onSome: (hit) => itemOf(hit.object),
      });
    };
    const press = (event: PointerEvent) => {
      pressed.set(event.clientX, event.clientY);
    };
    const release = (event: PointerEvent) => {
      if (
        Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >
        CLICK_TRAVEL
      ) {
        return;
      }
      const item = under(event);
      if (item !== undefined) {
        pick(item);
      }
    };
    const hover = (event: PointerEvent) => {
      if (event.buttons !== 0 || event.pointerType !== "mouse") {
        return;
      }
      canvas.style.cursor = under(event) === undefined ? "grab" : "pointer";
    };
    canvas.addEventListener("pointerdown", press);
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointermove", hover);
    return () => {
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointermove", hover);
    };
  }, [camera, canvas, pick, scene]);

  return null;
}
