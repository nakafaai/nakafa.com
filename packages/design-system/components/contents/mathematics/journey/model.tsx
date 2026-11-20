import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  BOARD,
  graphSpot,
  RUN_ON,
  roadX,
  type Sheet,
  treeSpots,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr } from "effect";

/** How high the board's base stands, and the asphalt's top, which the vehicles drive on. */
const BASE = 0.006;
export const ROAD_TOP = 0.0078;

/** How long a dash of the centre line is, and from one dash to the next. */
const DASH = { length: 0.012, spacing: 0.026 } as const;

/** How far the left and right verges' things stand from the road's middle. */
const VERGE = BOARD.asphalt / 2 + (BOARD.width - BOARD.asphalt) / 4;
const LEFT_VERGE = -VERGE;

/** The largest a stop's name is drawn on a narrow card and on a wide one, in pixels. */
const NAME_SIZE = { narrow: 13, wide: 15 } as const;

/** An oiled beech table, wider and deeper than the camera sees, its top at y = 0. */
function Table({ x, z }: { readonly x: number; readonly z: number }) {
  return (
    <mesh position={[x, -0.02, z]} receiveShadow>
      <boxGeometry args={[3.2, 0.04, 2.4]} />
      <SurfaceMaterial
        bump={0.03}
        color={JOURNEY_COLORS.table}
        repeat={[1.4, 1]}
        roughness={0.5}
        surface="wood"
      />
    </mesh>
  );
}

/**
 * A model road on a flocked grass board, its middle at x = 0, from z = `back`
 * to z = `front`: matt asphalt with white edge lines and a dashed centre
 * line, a white line across it at the start, and a white post on the right
 * verge at every kilometre mark of the graph.
 */
function Roadway({
  back,
  front,
  marks,
  start,
}: {
  readonly back: number;
  readonly front: number;
  readonly marks: readonly number[];
  readonly start: number;
}) {
  const length = front - back;
  const middle = (front + back) / 2;
  const dashes = Math.floor(length / DASH.spacing);
  return (
    <group>
      <mesh castShadow position={[0, BASE / 2, middle]} receiveShadow>
        <boxGeometry args={[BOARD.width, BASE, length]} />
        <meshStandardMaterial
          color={JOURNEY_COLORS.boardEdge}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, BASE + 0.0004, middle]} receiveShadow>
        <boxGeometry args={[BOARD.width - 0.004, 0.0008, length - 0.004]} />
        <SurfaceMaterial
          bump={0.3}
          color={JOURNEY_COLORS.grass}
          repeat={[1, length * 8]}
          roughness={0.95}
          surface="cloth"
        />
      </mesh>
      <mesh position={[0, ROAD_TOP - 0.0006, middle]} receiveShadow>
        <boxGeometry args={[BOARD.asphalt, 0.0012, length]} />
        <meshStandardMaterial color={JOURNEY_COLORS.asphalt} roughness={0.85} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[
            side * (BOARD.asphalt / 2 - 0.003),
            ROAD_TOP + 0.0002,
            middle,
          ]}
        >
          <boxGeometry args={[0.0016, 0.0004, length]} />
          <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
        </mesh>
      ))}
      {Arr.makeBy(dashes, (index) => (
        <mesh
          key={index}
          position={[0, ROAD_TOP + 0.0002, back + (index + 0.5) * DASH.spacing]}
        >
          <boxGeometry args={[0.0013, 0.0004, DASH.length]} />
          <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, ROAD_TOP + 0.0003, start]}>
        <boxGeometry args={[BOARD.asphalt - 0.004, 0.0004, 0.0035]} />
        <meshStandardMaterial color={JOURNEY_COLORS.paint} roughness={0.7} />
      </mesh>
      {Arr.map(marks, (z) => (
        <mesh castShadow key={z} position={[VERGE, BASE + 0.006, z]}>
          <boxGeometry args={[0.003, 0.012, 0.003]} />
          <meshStandardMaterial color={JOURNEY_COLORS.post} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A bus stop on the left verge, facing the road: a pale shelter with a blue
 * roof on two poles, and a pole with a blue sign beside it.
 */
function BusStop({ z }: { readonly z: number }) {
  return (
    <group position={[LEFT_VERGE, BASE, z]}>
      <mesh castShadow position={[-0.007, 0.009, 0]}>
        <boxGeometry args={[0.0018, 0.016, 0.03]} />
        <meshStandardMaterial color={JOURNEY_COLORS.shelter} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[-0.001, 0.0178, 0]}>
        <boxGeometry args={[0.017, 0.0018, 0.034]} />
        <meshStandardMaterial color={JOURNEY_COLORS.roof} roughness={0.6} />
      </mesh>
      {Arr.map([-0.015, 0.015] as const, (along) => (
        <mesh castShadow key={along} position={[0.006, 0.0085, along]}>
          <cylinderGeometry args={[0.0008, 0.0008, 0.017, 8]} />
          <meshStandardMaterial color={JOURNEY_COLORS.pole} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0.008, 0.012, -0.022]}>
        <cylinderGeometry args={[0.0007, 0.0007, 0.024, 8]} />
        <meshStandardMaterial color={JOURNEY_COLORS.pole} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.008, 0.022, -0.022]}>
        <boxGeometry args={[0.0012, 0.007, 0.009]} />
        <meshStandardMaterial color={JOURNEY_COLORS.sign} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** A small roadside tree on the left verge: a brown trunk under a round green crown. */
function Tree({ z }: { readonly z: number }) {
  return (
    <group position={[LEFT_VERGE, BASE, z]}>
      <mesh castShadow position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.0018, 0.0022, 0.012, 8]} />
        <meshStandardMaterial color={JOURNEY_COLORS.trunk} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.019, 0]}>
        <icosahedronGeometry args={[0.0105, 1]} />
        <meshStandardMaterial
          args={[
            {
              color: JOURNEY_COLORS.leaves,
              flatShading: true,
              roughness: 0.85,
            },
          ]}
        />
      </mesh>
    </group>
  );
}

/**
 * The table and the road on it: the road runs past both ends of the graph,
 * a post stands at every kilometre the graph numbers, and each stop has its
 * shelter on the left verge with its name beside it, trees filling the verge
 * between them.
 */
export function Roadside({
  narrow,
  sheet,
  stops,
  ticks,
  tops,
}: {
  readonly narrow: boolean;
  readonly sheet: Sheet;
  readonly stops: readonly { readonly at: number; readonly name: string }[];
  readonly ticks: readonly number[];
  readonly tops: { readonly km: number; readonly minute: number };
}) {
  const ink = useLabelInk();
  const middle = roadX(sheet);
  const zOf = (km: number) => graphSpot(sheet, tops, 0, km).z;
  const front = sheet.front + RUN_ON;
  const back = sheet.front - sheet.depth - RUN_ON;
  const stopZ = Arr.map(stops, (stop) => zOf(stop.at));
  return (
    <group>
      <Table
        x={sheet.left + sheet.width / 2 - 0.2}
        z={sheet.front - sheet.depth / 2}
      />
      <group position={[middle, 0, 0]}>
        <Roadway
          back={back}
          front={front}
          marks={Arr.map(ticks, zOf)}
          start={zOf(0)}
        />
        {Arr.map(stopZ, (z) => (
          <BusStop key={z} z={z} />
        ))}
        {Arr.map(treeSpots(back, front, stopZ), (z) => (
          <Tree key={z} z={z} />
        ))}
      </group>
      {Arr.map(stops, (stop) => (
        <ThreeLabel
          anchorX="right"
          color={ink}
          fontSize={0.034}
          key={stop.name}
          maximumFontSize={narrow ? NAME_SIZE.narrow : NAME_SIZE.wide}
          minimumFontSize={11}
          position={[middle - BOARD.width / 2 - 0.006, 0.01, zOf(stop.at)]}
        >
          {stop.name}
        </ThreeLabel>
      ))}
    </group>
  );
}
