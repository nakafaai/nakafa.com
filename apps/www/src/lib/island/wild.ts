import { Array as Arr, Option, Record as Rec } from "effect";
import type { Dice } from "@/lib/island/fauna/cast";
import { castOf, packSize } from "@/lib/island/fauna/cast";
import type { Family } from "@/lib/island/fauna/families";
import type { Survey } from "@/lib/island/fauna/habitat";
import { cellKey } from "@/lib/island/fauna/habitat";
import { SPECIES } from "@/lib/island/fauna/species";
import type { Land } from "@/lib/island/land/ground";
import type { Animal, Dweller } from "@/lib/island/life";
import { paceOf, wander } from "@/lib/island/life";
import { hashOf, unitOf } from "@/lib/island/noise";
import { roomOf, shapeOf, touches } from "@/lib/island/room";

/**
 * Who walks and floats in a cell of the land (ADR 0050, W9), one line a
 * pack: its role in the cast, the habitats it is found in and how many places
 * of them the cell must offer, which of those places it starts about, the
 * ground it keeps to, how many it is at most, how often a cell holds it, and
 * whether the day decides its species, as it does for a visitor.
 */
const PLANS = [
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "dry",
    habitats: ["meadow", "grass"],
    most: 6,
    need: 12,
    role: "herds",
  },
  {
    at: 5,
    chance: 0.5,
    daily: false,
    ground: "dry",
    habitats: ["meadow", "grass"],
    most: 3,
    need: 6,
    role: "hens",
  },
  {
    at: 9,
    chance: 0.7,
    daily: true,
    ground: "dry",
    habitats: ["meadow", "grass"],
    most: 1,
    need: 10,
    role: "prowlers",
  },
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "dry",
    habitats: ["forest"],
    most: 3,
    need: 8,
    role: "climbers",
  },
  {
    at: 4,
    chance: 0.8,
    daily: true,
    ground: "dry",
    habitats: ["forest"],
    most: 1,
    need: 12,
    role: "prowlers",
  },
  {
    at: 7,
    chance: 0.8,
    daily: true,
    ground: "dry",
    habitats: ["forest"],
    most: 1,
    need: 12,
    role: "creepers",
  },
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "dry",
    habitats: ["highland"],
    most: 4,
    need: 8,
    role: "highland",
  },
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "sand",
    habitats: ["shore"],
    most: 4,
    need: 4,
    role: "crabs",
  },
  {
    at: 3,
    chance: 0.7,
    daily: true,
    ground: "dry",
    habitats: ["shore"],
    most: 2,
    need: 8,
    role: "shore",
  },
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "afloat",
    habitats: ["fresh"],
    most: 3,
    need: 4,
    role: "fowl",
  },
  {
    at: 0,
    chance: 1,
    daily: false,
    ground: "bank",
    habitats: ["fresh", "shore"],
    most: 1,
    need: 4,
    role: "waders",
  },
  {
    at: 0,
    chance: 0.6,
    daily: true,
    ground: "afloat",
    habitats: ["shallows", "sea"],
    most: 2,
    need: 24,
    role: "seabirds",
  },
] as const;

/** The families that run from the learner's fox: grazers, the small and the quick. */
const SHY: readonly Family[] = ["hoof", "tall", "rodent", "crab", "frog"];

/** How a shy animal flees (ADR 0050, W9): from a fox nearer than `near` blocks, `run` blocks straight away from it, `haste` times as fast as it strolls. */
const FLEE = { haste: 2.6, near: 5, run: 7 } as const;

/** How long an animal stands for the learner who stroked it, in seconds. */
export const PET = 3.2;

/** Whether an animal runs from the fox. */
function isShy(kind: Animal["kind"]) {
  return typeof kind === "number"
    ? Arr.contains(SHY, SPECIES[kind].family)
    : kind === "hen";
}

/** Which animal a plan gives one cell, none when the dice pass it over or the catalogue has none for its role. */
function kindOf(
  plan: (typeof PLANS)[number],
  slot: number,
  dice: Dice
): Option.Option<Animal["kind"]> {
  if (unitOf(dice.seed + 611, dice.gx, slot, dice.gz) >= plan.chance) {
    return Option.none();
  }
  return plan.role === "hens"
    ? Option.some("hen")
    : castOf(plan.role, dice, plan.daily ? dice.day + slot : 0);
}

/**
 * The members of one pack where they start (ADR 0047, D22): up to `count` of
 * a kind on a widening spiral about a spot, each where it fits on its ground,
 * clear of what `blocked` answers for and apart from every animal placed
 * before it.
 */
function packOf(
  land: Land,
  plan: {
    readonly count: number;
    readonly ground: Dweller["ground"];
    readonly kind: Animal["kind"];
    readonly pack: number;
    readonly x: number;
    readonly z: number;
  },
  dice: Dice,
  placed: {
    readonly blocked: (x: number, z: number, half: number) => boolean;
    readonly taken: readonly Dweller[];
  }
) {
  const gap = Math.max(0.9, shapeOf(plan.kind).half * 2 + 0.4);
  return Arr.reduce(
    Arr.range(0, 23 + plan.count * 8),
    Arr.empty<Dweller>(),
    (pack, slot) => {
      if (pack.length >= plan.count) {
        return pack;
      }
      const out = gap * Math.sqrt(slot);
      const x = plan.x + Math.cos(slot * 2.4) * out;
      const z = plan.z + Math.sin(slot * 2.4) * out;
      const body: Dweller = {
        cell: cellKey(dice.gx, dice.gz),
        ground: plan.ground,
        hx: plan.x,
        hz: plan.z,
        kind: plan.kind,
        pack: plan.pack,
        pet: 0,
        rest: unitOf(dice.seed + 613, plan.pack, slot, dice.gx) * 3,
        seed: hashOf(dice.seed + 617, dice.gx * 31 + plan.pack, slot, dice.gz),
        steps: 0,
        tx: x,
        tz: z,
        x,
        z,
      };
      const fits =
        roomOf(land, body, { x, yaw: 0, z }, placed.blocked) &&
        !Arr.some([...placed.taken, ...pack], (other) => touches(body, other));
      return fits ? Arr.append(pack, body) : pack;
    }
  );
}

/**
 * The animals that walk and float in one cell of the land (ADR 0050, W9), by
 * the seed, the cell and the day: a herd on the meadow and the open grass,
 * hens, climbers in the forest, grazers on the highland, crabs on the sand,
 * fowl on fresh water, a wader at the bank and seabirds afloat, with the
 * visitors the day brings to each, every one placed where it fits.
 */
export function dwellersOf(
  land: Land,
  survey: Survey,
  dice: Dice,
  blocked: (x: number, z: number, half: number) => boolean
): readonly Dweller[] {
  return Arr.reduce(PLANS, Arr.empty<Dweller>(), (taken, plan, slot) => {
    const spots = Arr.flatMap(plan.habitats, (habitat) => survey[habitat]);
    const found = Option.all({
      kind: kindOf(plan, slot, dice),
      spot: spots.length >= plan.need ? Arr.get(spots, plan.at) : Option.none(),
    });
    return Option.match(found, {
      onNone: () => taken,
      onSome: ({ kind, spot }) => {
        const count =
          typeof kind === "number" && plan.most > 2
            ? packSize(kind, plan.most)
            : plan.most;
        return [
          ...taken,
          ...packOf(
            land,
            {
              count,
              ground: plan.ground,
              kind,
              pack: slot,
              x: spot.x,
              z: spot.z,
            },
            dice,
            { blocked, taken }
          ),
        ];
      },
    });
  });
}

/** An animal the learner stroked, `dt` seconds on: it stands where it is and faces the fox, or straight on when no fox is about. */
function stroked(animal: Dweller, dt: number, fox: Option.Option<Animal>) {
  const pet = Math.max(0, animal.pet - dt);
  return Option.match(fox, {
    onNone: () => ({ ...animal, pet, rest: 0.3, tx: animal.x, tz: animal.z }),
    onSome: (toward) => {
      const [dx, dz] = [toward.x - animal.x, toward.z - animal.z];
      const distance = Math.max(1e-6, Math.hypot(dx, dz));
      return {
        ...animal,
        pet,
        rest: 0.3,
        tx: animal.x + (dx / distance) * 0.06,
        tz: animal.z + (dz / distance) * 0.06,
      };
    },
  });
}

/**
 * The animals of one cell `dt` seconds on (ADR 0047, D22; ADR 0050, W9):
 * each wanders about the middle of its pack, which its own spot draws back,
 * so a herd moves as a herd; a shy one near a fox of `threats` runs straight
 * away from it; one the learner stroked stands and faces the fox; and none
 * walks into what `blocked` answers for, into `others` or into a pack mate.
 */
export function roamed(
  land: Land,
  dwellers: readonly Dweller[],
  step: {
    readonly blocked: (x: number, z: number, half: number) => boolean;
    readonly dt: number;
    readonly others: readonly Animal[];
    readonly threats: readonly Animal[];
  }
): readonly Dweller[] {
  const packs = Rec.map(
    Arr.groupBy(dwellers, (animal) => String(animal.pack)),
    (pack) => ({
      x: Arr.reduce(pack, 0, (sum, animal) => sum + animal.x) / pack.length,
      z: Arr.reduce(pack, 0, (sum, animal) => sum + animal.z) / pack.length,
    })
  );
  const everyone = [...dwellers, ...step.others, ...step.threats];
  return Arr.map(dwellers, (animal) => {
    if (animal.pet > 0) {
      return stroked(animal, step.dt, Arr.head(step.threats));
    }
    const middle = packs[String(animal.pack)];
    const scare = Arr.findFirst(
      isShy(animal.kind) ? step.threats : [],
      (threat) =>
        Math.hypot(threat.x - animal.x, threat.z - animal.z) < FLEE.near
    );
    const fleeing = Option.match(scare, {
      onNone: () => animal,
      onSome: (threat) => {
        const [dx, dz] = [animal.x - threat.x, animal.z - threat.z];
        const distance = Math.max(1e-6, Math.hypot(dx, dz));
        return {
          ...animal,
          rest: 0,
          tx: animal.x + (dx / distance) * FLEE.run,
          tz: animal.z + (dz / distance) * FLEE.run,
        };
      },
    });
    return wander(land, fleeing, {
      blocked: step.blocked,
      dt: step.dt,
      home: [
        middle.x * 0.7 + animal.hx * 0.3,
        middle.z * 0.7 + animal.hz * 0.3,
      ],
      others: everyone,
      pace: paceOf(animal.kind) * (Option.isSome(scare) ? FLEE.haste : 1),
      spread: 3 + shapeOf(animal.kind).reach * 2,
    });
  });
}
