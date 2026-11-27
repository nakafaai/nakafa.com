import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Order, Schema } from "effect";

/** The two kinds of nucleon. */
export const NucleonSchema = Schema.Literals(["neutron", "proton"]);
export type Nucleon = typeof NucleonSchema.Type;

/** One nucleon of a packed nucleus: its kind and where its middle is, in nucleon radii. */
const PackedSchema = Schema.Struct({
  at: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  kind: NucleonSchema,
});
export type Packed = typeof PackedSchema.Type;

/** The share of space randomly close-packed equal spheres fill (Jaeger and Nagel 1992). */
const DENSITY = 0.64;

/** The golden angle, which spreads the starting places evenly over each sphere. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** How many times the nucleons are drawn together and pushed apart, and how strongly each round draws them in. */
const ROUNDS = 90;
const SETTLE = 12;
const DRAW = 0.03;

/**
 * Pushes every pair of nucleons that overlap apart along the line between
 * their middles until they touch, each by half of the overlap.
 */
function part(places: Float64Array) {
  for (let first = 0; first < places.length; first += 3) {
    for (let second = first + 3; second < places.length; second += 3) {
      const x = Number(places[second]) - Number(places[first]);
      const y = Number(places[second + 1]) - Number(places[first + 1]);
      const z = Number(places[second + 2]) - Number(places[first + 2]);
      const gap = Math.hypot(x, y, z);
      if (gap < 2) {
        const push = (2 - gap) / (2 * gap);
        places[first] = Number(places[first]) - x * push;
        places[first + 1] = Number(places[first + 1]) - y * push;
        places[first + 2] = Number(places[first + 2]) - z * push;
        places[second] = Number(places[second]) + x * push;
        places[second + 1] = Number(places[second + 1]) + y * push;
        places[second + 2] = Number(places[second + 2]) + z * push;
      }
    }
  }
}

/**
 * Where `mass` touching spheres of radius one settle when the strong force
 * draws them into a ball: started evenly through a ball of the size they
 * will fill, then drawn toward the middle and pushed off each other, round
 * after round, until they rest against their neighbours in a random close
 * packing, as marbles do in a bag.
 */
function settle(mass: number) {
  const places = new Float64Array(mass * 3);
  const reach = Math.cbrt(mass / DENSITY);
  for (let index = 0; index < mass; index += 1) {
    const far = reach * Math.cbrt((index + 0.5) / mass);
    const height = 1 - (2 * (index + 0.5)) / mass;
    const flat = Math.sqrt(1 - height * height);
    places[index * 3] = Math.cos(index * GOLDEN) * flat * far;
    places[index * 3 + 1] = height * far;
    places[index * 3 + 2] = Math.sin(index * GOLDEN) * flat * far;
  }
  for (let round = 0; round < ROUNDS + SETTLE; round += 1) {
    if (round < ROUNDS) {
      for (let slot = 0; slot < places.length; slot += 1) {
        places[slot] = Number(places[slot]) * (1 - DRAW);
      }
    }
    part(places);
  }
  return places;
}

/**
 * A nucleus of `protons` and `neutrons` as its nucleons, each a sphere of
 * radius one: packed at random as closely as they will go, every nucleon
 * resting against its neighbours, so the whole is a ball whose radius grows
 * with the cube root of the mass number, as a real nucleus does. Protons
 * and neutrons are mixed through it. The packing is the same on every
 * device and centred on the origin; a count below zero is taken as zero.
 */
export function packOf(protons: number, neutrons: number): readonly Packed[] {
  const charge = Math.max(0, Math.floor(protons));
  const mass = charge + Math.max(0, Math.floor(neutrons));
  if (mass === 0) {
    return [];
  }
  const places = settle(mass);
  const slots = Arr.makeBy(mass, (index) => index);
  const middle = Arr.map([0, 1, 2] as const, (axis) =>
    Arr.reduce(
      slots,
      0,
      (sum, index) => sum + Number(places[index * 3 + axis]) / mass
    )
  );
  const charged = Arr.take(
    Arr.sort(
      slots,
      Order.mapInput(Order.Number, (index: number) => chanceAt(index, mass, 5))
    ),
    charge
  );
  return Arr.map(slots, (index) => ({
    at: [
      Number(places[index * 3]) - Number(middle[0]),
      Number(places[index * 3 + 1]) - Number(middle[1]),
      Number(places[index * 3 + 2]) - Number(middle[2]),
    ] as const,
    kind: Arr.contains(charged, index)
      ? ("proton" as const)
      : ("neutron" as const),
  }));
}

/** The radius of the ball a packed nucleus fills, in nucleon radii: its farthest nucleon's middle plus that nucleon's own radius. */
export function reachOf(nucleons: readonly Packed[]) {
  return (
    Arr.reduce(nucleons, 0, (far, nucleon) =>
      Math.max(far, Math.hypot(...nucleon.at))
    ) + 1
  );
}
