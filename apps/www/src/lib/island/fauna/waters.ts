import { animal } from "@/lib/island/fauna/animal";

/** Fish, eels, rays and turtles of the island's fauna, each at its real height in blocks. */
export const WATERS = [
  animal(
    "clownfish",
    "fish",
    ["ginger", "plaster", "coal", "plaster"],
    "bands",
    ["none", "none", "none", false],
    0.1,
    "sea"
  ),
  animal(
    "goldfish",
    "fish",
    ["sun", "cream", "ginger", "sun"],
    "none",
    ["none", "none", "none", false],
    0.15,
    "sea"
  ),
  animal(
    "koi",
    "fish",
    ["plaster", "plaster", "coral", "coral"],
    "patch",
    ["none", "none", "none", false],
    0.6,
    "sea"
  ),
  animal(
    "tilapia",
    "fish",
    ["ash", "cream", "coral", "ash"],
    "stripes",
    ["none", "none", "none", false],
    0.35,
    "sea"
  ),
  animal(
    "catfish",
    "fish",
    ["coal", "ash", "tan", "coal"],
    "none",
    ["none", "none", "none", false],
    0.5,
    "sea"
  ),
  animal(
    "carp",
    "fish",
    ["sun", "cream", "rust", "ginger"],
    "none",
    ["none", "none", "none", false],
    0.5,
    "sea"
  ),
  animal(
    "grouper",
    "fish",
    ["tan", "cream", "rust", "rust"],
    "spots",
    ["none", "none", "none", true],
    1.0,
    "sea"
  ),
  animal(
    "snapper",
    "fish",
    ["coral", "pink", "coral", "coral"],
    "none",
    ["none", "none", "none", false],
    0.6,
    "sea"
  ),
  animal(
    "tuna",
    "fish",
    ["sky", "plaster", "sun", "slate"],
    "none",
    ["none", "none", "none", false],
    1.6,
    "sea"
  ),
  animal(
    "mackerel",
    "fish",
    ["teal", "plaster", "sun", "slate"],
    "stripes",
    ["none", "none", "none", false],
    0.3,
    "sea"
  ),
  animal(
    "milkfish",
    "fish",
    ["ash", "plaster", "sky", "ash"],
    "none",
    ["none", "none", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "betta",
    "fish",
    ["coral", "coral", "violet", "violet"],
    "none",
    ["none", "none", "none", true],
    0.07,
    "sea"
  ),
  animal(
    "angelfish",
    "fish",
    ["sun", "plaster", "coal", "coal"],
    "stripes",
    ["none", "none", "none", true],
    0.15,
    "sea"
  ),
  animal(
    "pufferfish",
    "fish",
    ["sand", "plaster", "coal", "tan"],
    "spots",
    ["none", "none", "none", true],
    0.3,
    "sea"
  ),
  animal(
    "arowana",
    "fish",
    ["coral", "sun", "sun", "coral"],
    "none",
    ["none", "none", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "gourami",
    "fish",
    ["olive", "cream", "sky", "olive"],
    "stripes",
    ["none", "none", "none", false],
    0.5,
    "sea"
  ),
  animal(
    "blue-tang",
    "fish",
    ["sky", "sky", "sun", "coal"],
    "none",
    ["none", "none", "none", true],
    0.25,
    "sea"
  ),
  animal(
    "salmon",
    "fish",
    ["coral", "plaster", "ash", "pink"],
    "spots",
    ["none", "none", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "eel",
    "eel",
    ["olive", "sand", "olive", "olive"],
    "none",
    ["none", "none", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "moray",
    "eel",
    ["sun", "sun", "coal", "coal"],
    "spots",
    ["none", "none", "none", false],
    1.2,
    "sea"
  ),
  animal(
    "barracuda",
    "eel",
    ["ash", "plaster", "coal", "ash"],
    "stripes",
    ["none", "none", "none", false],
    1.4,
    "sea"
  ),
  animal(
    "needlefish",
    "eel",
    ["teal", "plaster", "sky", "teal"],
    "none",
    ["none", "none", "none", false],
    0.7,
    "sea"
  ),
  animal(
    "manta",
    "ray",
    ["coal", "plaster", "coal", "coal"],
    "none",
    ["none", "none", "none", false],
    4.0,
    "sea"
  ),
  animal(
    "stingray",
    "ray",
    ["tan", "cream", "bark", "bark"],
    "spots",
    ["none", "none", "none", false],
    1.0,
    "sea"
  ),
  animal(
    "flounder",
    "ray",
    ["sand", "cream", "tan", "tan"],
    "spots",
    ["none", "none", "none", false],
    0.4,
    "sea"
  ),
  animal(
    "sea-turtle",
    "turtle",
    ["olive", "sand", "olive", "tan"],
    "patch",
    ["none", "none", "none", false],
    0.9,
    "sea"
  ),
  animal(
    "hawksbill",
    "turtle",
    ["tan", "sand", "olive", "rust"],
    "spots",
    ["none", "none", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "tortoise",
    "turtle",
    ["bark", "sand", "olive", "tan"],
    "patch",
    ["none", "none", "none", false],
    0.6,
    "land"
  ),
] as const;
