import { animal } from "@/lib/island/fauna/animal";

/** Predators, small mammals and rodents of the island's fauna, each at its real height in blocks. */
export const BEASTS = [
  animal(
    "cat",
    "small",
    ["ginger", "cream", "coral", "rust"],
    "stripes",
    ["point", "long", "none", false],
    0.4,
    "land"
  ),
  animal(
    "tabby",
    "small",
    ["ash", "cream", "coral", "coal"],
    "stripes",
    ["point", "long", "none", false],
    0.4,
    "land"
  ),
  animal(
    "dog",
    "small",
    ["tan", "cream", "coral", "bark"],
    "patch",
    ["round", "short", "none", false],
    0.6,
    "land"
  ),
  animal(
    "fox",
    "small",
    ["ginger", "cream", "coal", "ginger"],
    "none",
    ["point", "bushy", "none", false],
    0.5,
    "land"
  ),
  animal(
    "fennec",
    "small",
    ["sand", "cream", "coral", "tan"],
    "none",
    ["long", "bushy", "none", false],
    0.35,
    "land"
  ),
  animal(
    "wolf",
    "small",
    ["ash", "cream", "coal", "coal"],
    "none",
    ["point", "bushy", "none", false],
    0.9,
    "land"
  ),
  animal(
    "raccoon",
    "small",
    ["ash", "cream", "coal", "coal"],
    "bands",
    ["round", "bushy", "none", false],
    0.4,
    "land"
  ),
  animal(
    "red-panda",
    "small",
    ["rust", "coal", "cream", "ginger"],
    "bands",
    ["point", "bushy", "none", false],
    0.5,
    "land"
  ),
  animal(
    "civet",
    "small",
    ["tan", "cream", "coal", "coal"],
    "spots",
    ["point", "long", "none", false],
    0.4,
    "land"
  ),
  animal(
    "mongoose",
    "small",
    ["olive", "cream", "coal", "tan"],
    "none",
    ["round", "long", "none", false],
    0.3,
    "land"
  ),
  animal(
    "otter",
    "small",
    ["bark", "cream", "coal", "bark"],
    "none",
    ["round", "long", "none", false],
    0.4,
    "shore"
  ),
  animal(
    "badger",
    "small",
    ["ash", "plaster", "coal", "coal"],
    "bands",
    ["round", "short", "none", false],
    0.4,
    "land"
  ),
  animal(
    "lynx",
    "small",
    ["sand", "cream", "coal", "tan"],
    "spots",
    ["point", "short", "none", false],
    0.7,
    "land"
  ),
  animal(
    "leopard",
    "small",
    ["sun", "cream", "coal", "coal"],
    "spots",
    ["round", "long", "none", false],
    0.8,
    "land"
  ),
  animal(
    "tiger",
    "small",
    ["ginger", "plaster", "coal", "coal"],
    "stripes",
    ["round", "long", "none", false],
    1.1,
    "land"
  ),
  animal(
    "lion",
    "small",
    ["sun", "cream", "rust", "tan"],
    "none",
    ["round", "long", "none", true],
    1.2,
    "land"
  ),
  animal(
    "cheetah",
    "small",
    ["sun", "plaster", "coal", "coal"],
    "spots",
    ["round", "long", "none", false],
    0.9,
    "land"
  ),
  animal(
    "panther",
    "small",
    ["coal", "coal", "sun", "coal"],
    "none",
    ["round", "long", "none", false],
    0.8,
    "land"
  ),
  animal(
    "clouded-leopard",
    "small",
    ["tan", "cream", "coal", "coal"],
    "patch",
    ["round", "long", "none", false],
    0.7,
    "land"
  ),
  animal(
    "hyena",
    "small",
    ["sand", "cream", "coal", "coal"],
    "spots",
    ["round", "short", "none", false],
    0.9,
    "land"
  ),
  animal(
    "mouse",
    "rodent",
    ["ash", "cream", "pink", "ash"],
    "none",
    ["round", "long", "none", false],
    0.12,
    "land"
  ),
  animal(
    "hamster",
    "rodent",
    ["sun", "cream", "pink", "ginger"],
    "patch",
    ["round", "none", "none", false],
    0.15,
    "land"
  ),
  animal(
    "squirrel",
    "rodent",
    ["rust", "cream", "coal", "ginger"],
    "none",
    ["point", "bushy", "none", false],
    0.25,
    "land"
  ),
  animal(
    "chipmunk",
    "rodent",
    ["tan", "cream", "coal", "coal"],
    "stripes",
    ["round", "bushy", "none", false],
    0.18,
    "land"
  ),
  animal(
    "guinea-pig",
    "rodent",
    ["cream", "plaster", "pink", "ginger"],
    "patch",
    ["round", "none", "none", false],
    0.2,
    "land"
  ),
  animal(
    "hedgehog",
    "rodent",
    ["bark", "cream", "coal", "tan"],
    "spots",
    ["none", "none", "none", false],
    0.2,
    "land"
  ),
  animal(
    "porcupine",
    "rodent",
    ["coal", "tan", "plaster", "plaster"],
    "stripes",
    ["none", "short", "none", false],
    0.4,
    "land"
  ),
  animal(
    "beaver",
    "rodent",
    ["bark", "tan", "coal", "bark"],
    "none",
    ["round", "short", "none", false],
    0.4,
    "shore"
  ),
  animal(
    "rabbit",
    "rodent",
    ["plaster", "plaster", "pink", "ash"],
    "none",
    ["long", "short", "none", false],
    0.35,
    "land"
  ),
  animal(
    "hare",
    "rodent",
    ["tan", "cream", "coal", "tan"],
    "none",
    ["long", "short", "none", false],
    0.45,
    "land"
  ),
] as const;
