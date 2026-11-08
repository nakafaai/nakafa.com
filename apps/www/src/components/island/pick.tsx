import type { ThreeEvent } from "@react-three/fiber";
import {
  applyOperations,
  type Operation,
} from "@repo/backend/confect/island/build";
import { footprintOf, kindOf } from "@repo/backend/confect/island/item";
import { Array as Arr, Option, Result } from "effect";
import { useMemo, useRef, useState } from "react";
import { type Group, Vector3 } from "three";
import { useEditIsland } from "@/components/island/edit";
import { useTools } from "@/components/island/tools";
import { VoxelMesh } from "@/components/island/voxels";
import { aimedItem, aimedOperation } from "@/lib/island/aim";
import { useIsland } from "@/lib/island/context";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";
import { drawModel } from "@/lib/island/voxel";

/** A cell of the island: east, south and layer. */
type Cell = Extract<Operation, { _tag: "remove" }>["at"];

/** The cell a press aims at: the one just outside the face it pressed. */
function cellOf(group: Group, event: ThreeEvent<PointerEvent | MouseEvent>) {
  const local = group.worldToLocal(event.point.clone());
  const normal = event.face?.normal ?? new Vector3(0, 1, 0);
  local.addScaledVector(normal, 0.01);
  return {
    x: Math.floor(local.x),
    y: Math.floor(local.z),
    z: Math.max(0, Math.floor(local.y)),
  };
}

/** A ring a voxel high around a footprint, gold where it fits and red where it does not. */
function ring(width: number, depth: number, fits: boolean) {
  const side = [width * VOXELS_PER_CELL, 1, depth * VOXELS_PER_CELL] as const;
  return drawModel(side, [
    {
      _tag: "box",
      from: [0, 0, 0],
      ramp: fits ? "glow" : "roof",
      to: [side[0] - 1, 0, side[2] - 1],
      tone: fits ? 3 : 2,
    },
    { _tag: "carve", from: [1, 0, 1], to: [side[0] - 2, 0, side[2] - 2] },
  ]);
}

/**
 * The owner's hand on the island while they build (ADR 0042, D12). Invisible
 * boxes over the ground and over every placement catch the pointer; the cell
 * just outside the pressed face is the target, and a ring shows there, gold when
 * the change fits and red when the rules refuse it. A press places the chosen
 * item, moves the picked placement, or picks the placement it lands on.
 */
export function IslandPicker() {
  const { layout, owner, size } = useIsland();
  const tools = useTools((state) => state);
  const edit = useEditIsland();
  const group = useRef<Group>(null);
  const [target, setTarget] = useState<Option.Option<Cell>>(Option.none);
  const pending = Option.flatMap(target, (to) =>
    aimedOperation(tools, to, layout)
  );
  const item = Option.flatMap(pending, (operation) =>
    aimedItem(operation, layout)
  );
  const fits = Option.exists(pending, (operation) =>
    Option.exists(owner, (facts) =>
      Result.isSuccess(
        applyOperations(layout, [operation], {
          level: facts.level,
          materials: facts.materials,
          size,
          stars: facts.stars,
        })
      )
    )
  );
  const footprint = Option.map(item, (chosen) =>
    footprintOf(chosen, tools.rotation)
  );
  const cursor = useMemo(
    () => Option.map(footprint, ([width, depth]) => ring(width, depth, fits)),
    [footprint, fits]
  );
  const aim = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    event.stopPropagation();
    if (group.current !== null) {
      setTarget(Option.some(cellOf(group.current, event)));
    }
  };
  // A tap on a phone moves no pointer first, so a press finds its own cell.
  const press = (event: ThreeEvent<MouseEvent>, at: Option.Option<Cell>) => {
    event.stopPropagation();
    if (group.current === null) {
      return;
    }
    const to = cellOf(group.current, event);
    setTarget(Option.some(to));
    const operation = aimedOperation(tools, to, layout);
    if (Option.isNone(operation)) {
      tools.select(at);
      return;
    }
    edit([operation.value], "edit");
    if (operation.value._tag === "move") {
      tools.select(Option.some(operation.value.to));
    }
  };
  return (
    <group ref={group}>
      <mesh
        onClick={(event) => press(event, Option.none())}
        onPointerMove={aim}
        position={[size / 2, -0.005, size / 2]}
      >
        <boxGeometry args={[size, 0.01, size]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {Arr.map(layout, (placement) => {
        const [width, depth] = footprintOf(placement.item, placement.rotation);
        const height = kindOf(placement.item) === "block" ? 1 : 1.5;
        const at = { x: placement.x, y: placement.y, z: placement.z };
        return (
          <mesh
            key={`${at.x}:${at.y}:${at.z}`}
            onClick={(event) => press(event, Option.some(at))}
            onPointerMove={aim}
            position={[at.x + width / 2, at.z + height / 2, at.y + depth / 2]}
          >
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        );
      })}
      {Option.isSome(cursor) &&
      Option.isSome(target) &&
      Option.isSome(footprint) ? (
        <VoxelMesh
          grid={cursor.value}
          placements={[
            {
              angle: 0,
              center: [
                target.value.x + footprint.value[0] / 2,
                target.value.z,
                target.value.y + footprint.value[1] / 2,
              ],
              pivot: [
                (footprint.value[0] * VOXELS_PER_CELL) / 2,
                0,
                (footprint.value[1] * VOXELS_PER_CELL) / 2,
              ],
            },
          ]}
        />
      ) : null}
    </group>
  );
}
