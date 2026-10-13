import { bird } from "@repo/mascot/family/bird";
import { bug } from "@repo/mascot/family/bug";
import { carnivore } from "@repo/mascot/family/carnivore";
import { farm } from "@repo/mascot/family/farm";
import { marine } from "@repo/mascot/family/marine";
import { primate } from "@repo/mascot/family/primate";
import { reptile } from "@repo/mascot/family/reptile";
import { small } from "@repo/mascot/family/small";
import { wild } from "@repo/mascot/family/wild";
import type { Design } from "@repo/mascot/kit";
import { Schema } from "effect";

/** Every animal by name, in the order that a seed picks from. */
export const Animal = Schema.Literals([
  "cat",
  "bear",
  "rabbit",
  "sheep",
  "fox",
  "panda",
  "koala",
  "frog",
  "chicken",
  "owl",
  "penguin",
  "hamster",
  "mouse",
  "cow",
  "tiger",
  "lion",
  "bee",
  "seal",
  "axolotl",
  "whale",
  "octopus",
  "komodo",
  "orangutan",
  "tarsier",
  "elephant",
  "rhino",
  "anoa",
  "turtle",
  "dog",
  "pig",
  "monkey",
  "proboscis",
  "deer",
  "giraffe",
  "zebra",
  "hippo",
  "horse",
  "goat",
  "duck",
  "cockatoo",
  "hornbill",
  "eagle",
  "parrot",
  "bat",
  "porcupine",
  "civet",
  "squirrel",
  "crab",
  "jellyfish",
  "pufferfish",
  "snail",
  "beetle",
  "crocodile",
  "raccoon",
  "flamingo",
  "peacock",
  "clownfish",
  "alpaca",
  "dragonfly",
  "spider",
  "cassowary",
  "butterfly",
  "starfish",
  "walrus",
  "snake",
]);

/** The palettes and the drawing of every animal, gathered from its family. */
export const DESIGNS: Record<typeof Animal.Type, Design> = {
  ...bird,
  ...bug,
  ...carnivore,
  ...farm,
  ...marine,
  ...primate,
  ...reptile,
  ...small,
  ...wild,
};
