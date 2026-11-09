import { animal } from "@/lib/island/fauna/animal";

/** Birds of the island's fauna, each at its real height in blocks. */
export const BIRDS = [
  animal(
    "sparrow",
    "songbird",
    ["tan", "cream", "sun", "bark"],
    "none",
    ["none", "short", "none", false],
    0.17,
    "sky"
  ),
  animal(
    "java-sparrow",
    "songbird",
    ["ash", "pink", "coral", "coal"],
    "none",
    ["none", "short", "none", false],
    0.17,
    "sky"
  ),
  animal(
    "robin",
    "songbird",
    ["bark", "coral", "sun", "bark"],
    "none",
    ["none", "short", "none", false],
    0.15,
    "sky"
  ),
  animal(
    "kingfisher",
    "songbird",
    ["sky", "ginger", "coral", "teal"],
    "none",
    ["none", "short", "none", false],
    0.18,
    "shore"
  ),
  animal(
    "pigeon",
    "songbird",
    ["ash", "ash", "coral", "violet"],
    "none",
    ["none", "short", "none", false],
    0.3,
    "sky"
  ),
  animal(
    "magpie-robin",
    "songbird",
    ["coal", "plaster", "sun", "coal"],
    "none",
    ["none", "long", "none", false],
    0.2,
    "sky"
  ),
  animal(
    "myna",
    "songbird",
    ["coal", "coal", "sun", "plaster"],
    "none",
    ["none", "short", "none", false],
    0.25,
    "sky"
  ),
  animal(
    "bulbul",
    "songbird",
    ["olive", "cream", "sun", "coal"],
    "none",
    ["none", "short", "none", true],
    0.2,
    "sky"
  ),
  animal(
    "canary",
    "songbird",
    ["sun", "sun", "coral", "sun"],
    "none",
    ["none", "short", "none", false],
    0.12,
    "sky"
  ),
  animal(
    "sunbird",
    "songbird",
    ["violet", "sun", "coral", "teal"],
    "none",
    ["none", "short", "none", false],
    0.11,
    "bloom"
  ),
  animal(
    "crow",
    "songbird",
    ["coal", "coal", "coal", "coal"],
    "none",
    ["none", "short", "none", false],
    0.45,
    "sky"
  ),
  animal(
    "woodpecker",
    "songbird",
    ["coal", "plaster", "coral", "plaster"],
    "spots",
    ["none", "short", "none", true],
    0.25,
    "sky"
  ),
  animal(
    "hummingbird",
    "songbird",
    ["teal", "plaster", "coal", "lime"],
    "none",
    ["none", "short", "none", false],
    0.09,
    "bloom"
  ),
  animal(
    "swallow",
    "songbird",
    ["sky", "cream", "coral", "coal"],
    "none",
    ["none", "long", "none", false],
    0.17,
    "sky"
  ),
  animal(
    "duck",
    "waterbird",
    ["tan", "cream", "sun", "bark"],
    "none",
    ["none", "short", "none", false],
    0.5,
    "sea"
  ),
  animal(
    "goose",
    "waterbird",
    ["plaster", "plaster", "sun", "ash"],
    "none",
    ["none", "short", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "swan",
    "waterbird",
    ["plaster", "plaster", "ginger", "plaster"],
    "none",
    ["none", "short", "none", true],
    1.2,
    "sea"
  ),
  animal(
    "teal-duck",
    "waterbird",
    ["ash", "cream", "coal", "teal"],
    "none",
    ["none", "short", "none", false],
    0.4,
    "sea"
  ),
  animal(
    "pelican",
    "waterbird",
    ["plaster", "plaster", "sun", "ash"],
    "none",
    ["none", "short", "none", true],
    1.3,
    "sea"
  ),
  animal(
    "cormorant",
    "waterbird",
    ["coal", "coal", "sun", "coal"],
    "none",
    ["none", "short", "none", false],
    0.8,
    "sea"
  ),
  animal(
    "heron",
    "wader",
    ["ash", "plaster", "sun", "coal"],
    "none",
    ["none", "short", "none", true],
    1.0,
    "shore"
  ),
  animal(
    "egret",
    "wader",
    ["plaster", "plaster", "sun", "plaster"],
    "none",
    ["none", "short", "none", false],
    0.9,
    "shore"
  ),
  animal(
    "flamingo",
    "wader",
    ["pink", "pink", "coal", "coral"],
    "none",
    ["none", "short", "none", false],
    1.3,
    "shore"
  ),
  animal(
    "stork",
    "wader",
    ["plaster", "plaster", "coral", "coal"],
    "none",
    ["none", "short", "none", false],
    1.1,
    "shore"
  ),
  animal(
    "crane",
    "wader",
    ["ash", "plaster", "coral", "coal"],
    "none",
    ["none", "short", "none", true],
    1.3,
    "shore"
  ),
  animal(
    "ibis",
    "wader",
    ["coral", "coral", "coal", "coral"],
    "none",
    ["none", "short", "none", false],
    0.7,
    "shore"
  ),
  animal(
    "owl",
    "perch",
    ["tan", "cream", "sun", "bark"],
    "spots",
    ["none", "short", "none", true],
    0.5,
    "sky"
  ),
  animal(
    "eagle",
    "perch",
    ["bark", "plaster", "sun", "bark"],
    "none",
    ["none", "short", "none", false],
    0.9,
    "sky"
  ),
  animal(
    "hawk",
    "perch",
    ["rust", "cream", "sun", "bark"],
    "stripes",
    ["none", "short", "none", false],
    0.6,
    "sky"
  ),
  animal(
    "parrot",
    "perch",
    ["lime", "sun", "coral", "sky"],
    "none",
    ["none", "long", "none", false],
    0.4,
    "sky"
  ),
  animal(
    "cockatoo",
    "perch",
    ["plaster", "plaster", "coal", "sun"],
    "none",
    ["none", "short", "none", true],
    0.5,
    "sky"
  ),
  animal(
    "macaw",
    "perch",
    ["coral", "sun", "plaster", "sky"],
    "none",
    ["none", "long", "none", false],
    0.8,
    "sky"
  ),
  animal(
    "hornbill",
    "perch",
    ["coal", "plaster", "sun", "coal"],
    "none",
    ["none", "long", "none", true],
    0.9,
    "sky"
  ),
  animal(
    "toucan",
    "perch",
    ["coal", "sun", "ginger", "coal"],
    "none",
    ["none", "short", "none", false],
    0.5,
    "sky"
  ),
  animal(
    "peacock",
    "perch",
    ["teal", "sky", "sun", "lime"],
    "spots",
    ["none", "long", "none", true],
    1.0,
    "land"
  ),
  animal(
    "lovebird",
    "perch",
    ["lime", "sun", "coral", "coral"],
    "none",
    ["none", "short", "none", false],
    0.15,
    "sky"
  ),
  animal(
    "bird-of-paradise",
    "perch",
    ["sun", "sun", "lime", "rust"],
    "none",
    ["none", "long", "none", true],
    0.4,
    "sky"
  ),
] as const;
