import { bird } from "@repo/mascot/family/bird";
import { bug } from "@repo/mascot/family/bug";
import { carnivore } from "@repo/mascot/family/carnivore";
import { hoofed } from "@repo/mascot/family/hoofed";
import { marine } from "@repo/mascot/family/marine";
import { primate } from "@repo/mascot/family/primate";
import { reptile } from "@repo/mascot/family/reptile";
import { small } from "@repo/mascot/family/small";
import type { Design } from "@repo/mascot/kit";
import { Schema } from "effect";

/** Every animal by name, in the order that a seed picks from. */
export const Animal = Schema.Literals([
  "kucing",
  "beruang",
  "kelinci",
  "domba",
  "rubah",
  "panda",
  "koala",
  "katak",
  "ayam",
  "burung-hantu",
  "penguin",
  "hamster",
  "tikus",
  "sapi",
  "harimau",
  "singa",
  "lebah",
  "anjing-laut",
  "axolotl",
  "paus",
  "gurita",
  "komodo",
  "orang-utan",
  "tarsius",
  "gajah",
  "badak",
  "anoa",
  "penyu",
  "anjing",
  "babi",
  "monyet",
  "bekantan",
  "rusa",
  "jerapah",
  "zebra",
  "kuda-nil",
  "kuda",
  "kambing",
  "bebek",
  "kakatua",
  "rangkong",
  "elang",
  "nuri",
  "kelelawar",
  "landak",
  "musang",
  "tupai",
  "kepiting",
  "ubur-ubur",
  "ikan-buntal",
  "siput",
  "kumbang",
  "buaya",
  "rakun",
  "flamingo",
  "merak",
  "badut",
  "alpaka",
  "capung",
  "laba",
  "kasuari",
  "kupu",
  "bintang",
  "walrus",
  "ular",
]);

/** The palettes and the drawing of every animal, gathered from its family. */
export const DESIGNS: Record<typeof Animal.Type, Design> = {
  ...bird,
  ...bug,
  ...carnivore,
  ...hoofed,
  ...marine,
  ...primate,
  ...reptile,
  ...small,
};
