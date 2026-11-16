import { animal } from "@/lib/island/fauna/animal";

/** Reptiles, frogs, insects, crabs and snails of the island's fauna, each at its real height in blocks. */
export const CRITTERS = [
  animal(
    "gecko",
    "lizard",
    ["olive", "sand", "coral", "coral"],
    "spots",
    ["none", "long", "none", false],
    0.15,
    "land"
  ),
  animal(
    "house-lizard",
    "lizard",
    ["sand", "cream", "tan", "tan"],
    "none",
    ["none", "long", "none", false],
    0.08,
    "land"
  ),
  animal(
    "iguana",
    "lizard",
    ["lime", "lime", "olive", "olive"],
    "stripes",
    ["none", "long", "none", true],
    0.5,
    "land"
  ),
  animal(
    "chameleon",
    "lizard",
    ["lime", "sun", "coral", "teal"],
    "bands",
    ["none", "long", "none", true],
    0.3,
    "land"
  ),
  animal(
    "komodo",
    "lizard",
    ["ash", "tan", "coral", "olive"],
    "none",
    ["none", "long", "none", false],
    0.9,
    "land"
  ),
  animal(
    "monitor",
    "lizard",
    ["coal", "sand", "coral", "sun"],
    "spots",
    ["none", "long", "none", false],
    0.6,
    "shore"
  ),
  animal(
    "crocodile",
    "lizard",
    ["olive", "sand", "olive", "coal"],
    "none",
    ["none", "long", "none", true],
    0.8,
    "shore"
  ),
  animal(
    "python",
    "snake",
    ["sun", "cream", "coral", "bark"],
    "patch",
    ["none", "none", "none", false],
    0.3,
    "land"
  ),
  animal(
    "cobra",
    "snake",
    ["coal", "cream", "coral", "sun"],
    "bands",
    ["none", "none", "none", true],
    0.5,
    "land"
  ),
  animal(
    "tree-snake",
    "snake",
    ["lime", "lime", "coral", "teal"],
    "none",
    ["none", "none", "none", false],
    0.2,
    "land"
  ),
  animal(
    "sea-snake",
    "snake",
    ["sky", "plaster", "coal", "coal"],
    "bands",
    ["none", "none", "none", false],
    0.2,
    "sea"
  ),
  animal(
    "frog",
    "frog",
    ["lime", "sun", "olive", "olive"],
    "spots",
    ["none", "none", "none", false],
    0.15,
    "shore"
  ),
  animal(
    "toad",
    "frog",
    ["olive", "sand", "tan", "bark"],
    "spots",
    ["none", "none", "none", false],
    0.15,
    "land"
  ),
  animal(
    "tree-frog",
    "frog",
    ["lime", "plaster", "coral", "lime"],
    "none",
    ["none", "none", "none", false],
    0.08,
    "land"
  ),
  animal(
    "dart-frog",
    "frog",
    ["sky", "coal", "coal", "coal"],
    "spots",
    ["none", "none", "none", false],
    0.05,
    "land"
  ),
  animal(
    "monarch",
    "butterfly",
    ["ginger", "sun", "coal", "plaster"],
    "none",
    ["none", "none", "none", false],
    0.15,
    "bloom"
  ),
  animal(
    "swallowtail",
    "butterfly",
    ["sun", "sun", "coal", "sky"],
    "none",
    ["none", "none", "none", false],
    0.15,
    "bloom"
  ),
  animal(
    "cabbage-white",
    "butterfly",
    ["plaster", "plaster", "cream", "coal"],
    "none",
    ["none", "none", "none", false],
    0.08,
    "bloom"
  ),
  animal(
    "birdwing",
    "butterfly",
    ["coal", "coal", "sun", "lime"],
    "none",
    ["none", "none", "none", false],
    0.25,
    "bloom"
  ),
  animal(
    "morpho",
    "butterfly",
    ["sky", "sky", "coal", "teal"],
    "none",
    ["none", "none", "none", false],
    0.2,
    "bloom"
  ),
  animal(
    "atlas-moth",
    "butterfly",
    ["rust", "cream", "tan", "plaster"],
    "none",
    ["none", "none", "none", false],
    0.3,
    "bloom"
  ),
  animal(
    "ladybird",
    "beetle",
    ["coral", "coral", "coal", "coal"],
    "spots",
    ["none", "none", "none", false],
    0.02,
    "bloom"
  ),
  animal(
    "rhino-beetle",
    "beetle",
    ["bark", "bark", "coal", "bark"],
    "none",
    ["none", "none", "horns", false],
    0.08,
    "land"
  ),
  animal(
    "stag-beetle",
    "beetle",
    ["coal", "coal", "rust", "coal"],
    "none",
    ["none", "none", "horns", false],
    0.07,
    "land"
  ),
  animal(
    "firefly",
    "beetle",
    ["coal", "coal", "sun", "sun"],
    "bands",
    ["none", "none", "none", false],
    0.02,
    "bloom"
  ),
  animal(
    "scarab",
    "beetle",
    ["teal", "teal", "lime", "lime"],
    "none",
    ["none", "none", "none", false],
    0.03,
    "land"
  ),
  animal(
    "honeybee",
    "bee",
    ["sun", "sun", "coal", "coal"],
    "bands",
    ["none", "short", "none", false],
    0.02,
    "bloom"
  ),
  animal(
    "bumblebee",
    "bee",
    ["coal", "sun", "coal", "sun"],
    "bands",
    ["none", "short", "none", false],
    0.03,
    "bloom"
  ),
  animal(
    "dragonfly",
    "bee",
    ["teal", "sky", "coal", "coal"],
    "bands",
    ["none", "long", "none", false],
    0.08,
    "bloom"
  ),
  animal(
    "wasp",
    "bee",
    ["sun", "sun", "coal", "coal"],
    "stripes",
    ["none", "short", "none", false],
    0.03,
    "bloom"
  ),
  animal(
    "damselfly",
    "bee",
    ["coral", "coral", "coal", "coal"],
    "bands",
    ["none", "long", "none", false],
    0.05,
    "bloom"
  ),
  animal(
    "crab",
    "crab",
    ["coral", "cream", "coral", "coral"],
    "none",
    ["none", "none", "none", false],
    0.15,
    "shore"
  ),
  animal(
    "hermit-crab",
    "crab",
    ["sand", "cream", "coral", "tan"],
    "spots",
    ["none", "none", "none", false],
    0.08,
    "shore"
  ),
  animal(
    "fiddler-crab",
    "crab",
    ["sky", "cream", "sun", "sky"],
    "none",
    ["none", "none", "none", false],
    0.05,
    "shore"
  ),
  animal(
    "lobster",
    "crab",
    ["rust", "coral", "rust", "rust"],
    "bands",
    ["none", "none", "none", false],
    0.4,
    "sea"
  ),
  animal(
    "snail",
    "snail",
    ["tan", "cream", "ginger", "bark"],
    "none",
    ["none", "none", "none", false],
    0.05,
    "land"
  ),
  animal(
    "sea-snail",
    "snail",
    ["coral", "cream", "pink", "coral"],
    "none",
    ["none", "none", "none", false],
    0.06,
    "shore"
  ),
] as const;
