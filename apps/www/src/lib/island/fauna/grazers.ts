import { animal } from "@/lib/island/fauna/animal";

/** Hoofed, heavy and tall mammals, elephants and primates of the island's fauna, each at its real height in blocks. */
export const GRAZERS = [
  animal(
    "deer",
    "hoof",
    ["tan", "cream", "coal", "plaster"],
    "none",
    ["point", "short", "antlers", false],
    1.3,
    "land"
  ),
  animal(
    "spotted-deer",
    "hoof",
    ["ginger", "cream", "coal", "plaster"],
    "spots",
    ["point", "short", "antlers", false],
    1.1,
    "land"
  ),
  animal(
    "mouse-deer",
    "hoof",
    ["rust", "cream", "coal", "tan"],
    "none",
    ["point", "short", "none", false],
    0.4,
    "land"
  ),
  animal(
    "goat",
    "hoof",
    ["plaster", "cream", "coal", "ash"],
    "patch",
    ["point", "short", "horns", false],
    0.9,
    "land"
  ),
  animal(
    "sheep",
    "hoof",
    ["cream", "plaster", "coal", "plaster"],
    "none",
    ["round", "short", "none", false],
    0.9,
    "land"
  ),
  animal(
    "horse",
    "hoof",
    ["bark", "tan", "coal", "bark"],
    "none",
    ["point", "long", "none", true],
    1.8,
    "land"
  ),
  animal(
    "pony",
    "hoof",
    ["cream", "plaster", "tan", "cream"],
    "none",
    ["point", "long", "none", true],
    1.2,
    "land"
  ),
  animal(
    "donkey",
    "hoof",
    ["ash", "plaster", "coal", "ash"],
    "none",
    ["long", "long", "none", true],
    1.4,
    "land"
  ),
  animal(
    "cow",
    "hoof",
    ["plaster", "plaster", "pink", "coal"],
    "patch",
    ["round", "long", "horns", false],
    1.6,
    "land"
  ),
  animal(
    "buffalo",
    "hoof",
    ["coal", "ash", "plaster", "coal"],
    "none",
    ["round", "long", "horns", false],
    1.7,
    "shore"
  ),
  animal(
    "banteng",
    "hoof",
    ["rust", "plaster", "plaster", "rust"],
    "none",
    ["round", "long", "horns", false],
    1.8,
    "land"
  ),
  animal(
    "zebra",
    "hoof",
    ["plaster", "plaster", "coal", "coal"],
    "stripes",
    ["point", "long", "none", true],
    1.6,
    "land"
  ),
  animal(
    "antelope",
    "hoof",
    ["tan", "plaster", "coal", "cream"],
    "none",
    ["point", "short", "horns", false],
    1.0,
    "land"
  ),
  animal(
    "moose",
    "hoof",
    ["bark", "tan", "coal", "bark"],
    "none",
    ["round", "short", "antlers", false],
    2.2,
    "land"
  ),
  animal(
    "reindeer",
    "hoof",
    ["ash", "plaster", "coal", "cream"],
    "none",
    ["point", "short", "antlers", false],
    1.3,
    "land"
  ),
  animal(
    "anoa",
    "hoof",
    ["coal", "ash", "plaster", "coal"],
    "none",
    ["round", "short", "horns", false],
    0.9,
    "land"
  ),
  animal(
    "bear",
    "heavy",
    ["bark", "tan", "coal", "bark"],
    "none",
    ["round", "short", "none", false],
    1.4,
    "land"
  ),
  animal(
    "sun-bear",
    "heavy",
    ["coal", "coal", "sun", "coal"],
    "none",
    ["round", "short", "none", false],
    0.9,
    "land"
  ),
  animal(
    "polar-bear",
    "heavy",
    ["plaster", "plaster", "coal", "cream"],
    "none",
    ["round", "short", "none", false],
    1.6,
    "shore"
  ),
  animal(
    "panda",
    "heavy",
    ["plaster", "plaster", "coal", "coal"],
    "patch",
    ["round", "short", "none", false],
    1.0,
    "land"
  ),
  animal(
    "pig",
    "heavy",
    ["pink", "pink", "coral", "pink"],
    "none",
    ["point", "short", "none", false],
    0.9,
    "land"
  ),
  animal(
    "boar",
    "heavy",
    ["bark", "tan", "plaster", "coal"],
    "none",
    ["point", "short", "tusks", false],
    0.9,
    "land"
  ),
  animal(
    "babirusa",
    "heavy",
    ["ash", "ash", "plaster", "ash"],
    "none",
    ["round", "short", "tusks", false],
    0.8,
    "land"
  ),
  animal(
    "rhino",
    "heavy",
    ["ash", "ash", "plaster", "ash"],
    "none",
    ["round", "short", "horns", false],
    1.8,
    "land"
  ),
  animal(
    "hippo",
    "heavy",
    ["violet", "pink", "pink", "violet"],
    "none",
    ["round", "short", "none", false],
    1.6,
    "shore"
  ),
  animal(
    "tapir",
    "heavy",
    ["coal", "plaster", "coal", "plaster"],
    "patch",
    ["round", "short", "none", false],
    1.1,
    "land"
  ),
  animal(
    "wombat",
    "heavy",
    ["tan", "tan", "coal", "bark"],
    "none",
    ["round", "none", "none", false],
    0.5,
    "land"
  ),
  animal(
    "capybara",
    "heavy",
    ["rust", "tan", "coal", "rust"],
    "none",
    ["round", "none", "none", false],
    0.6,
    "shore"
  ),
  animal(
    "giraffe",
    "tall",
    ["sun", "cream", "bark", "bark"],
    "spots",
    ["point", "long", "horns", false],
    5.0,
    "land"
  ),
  animal(
    "camel",
    "tall",
    ["sand", "cream", "bark", "tan"],
    "none",
    ["round", "short", "none", false],
    2.2,
    "land"
  ),
  animal(
    "llama",
    "tall",
    ["cream", "plaster", "tan", "tan"],
    "none",
    ["long", "short", "none", false],
    1.9,
    "land"
  ),
  animal(
    "alpaca",
    "tall",
    ["plaster", "plaster", "tan", "cream"],
    "none",
    ["long", "short", "none", false],
    1.5,
    "land"
  ),
  animal(
    "elephant",
    "elephant",
    ["ash", "ash", "plaster", "ash"],
    "none",
    ["round", "short", "tusks", false],
    3.0,
    "land"
  ),
  animal(
    "african-elephant",
    "elephant",
    ["stone", "stone", "plaster", "stone"],
    "none",
    ["round", "short", "tusks", false],
    3.6,
    "land"
  ),
  animal(
    "macaque",
    "primate",
    ["tan", "pink", "coral", "tan"],
    "none",
    ["round", "long", "none", false],
    0.6,
    "land"
  ),
  animal(
    "orangutan",
    "primate",
    ["rust", "ginger", "tan", "rust"],
    "none",
    ["none", "none", "none", false],
    1.3,
    "land"
  ),
  animal(
    "gibbon",
    "primate",
    ["ash", "cream", "plaster", "ash"],
    "none",
    ["none", "none", "none", false],
    0.7,
    "land"
  ),
  animal(
    "gorilla",
    "primate",
    ["coal", "ash", "ash", "coal"],
    "none",
    ["none", "none", "none", false],
    1.6,
    "land"
  ),
  animal(
    "chimpanzee",
    "primate",
    ["coal", "tan", "tan", "coal"],
    "none",
    ["round", "none", "none", false],
    1.2,
    "land"
  ),
  animal(
    "proboscis",
    "primate",
    ["ginger", "cream", "coral", "rust"],
    "none",
    ["none", "long", "none", false],
    0.7,
    "land"
  ),
  animal(
    "tarsier",
    "primate",
    ["tan", "cream", "sun", "tan"],
    "none",
    ["round", "long", "none", false],
    0.15,
    "land"
  ),
  animal(
    "lemur",
    "primate",
    ["ash", "plaster", "sun", "coal"],
    "bands",
    ["point", "long", "none", false],
    0.5,
    "land"
  ),
] as const;
