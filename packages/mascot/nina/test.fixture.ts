import { ActSchema } from "@repo/mascot/nina/act";
import { EdgeSchema } from "@repo/mascot/nina/edge";
import { MoodSchema } from "@repo/mascot/nina/face";
import { type Options, scene } from "@repo/mascot/nina/figure";
import { sha256Hex } from "@repo/utilities/digest";
import {
  Array as Arr,
  Effect,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

const SIDES = ["right", "left"] as const;
const LEANS = ["right", "left", "center"] as const;
const TIMES = [0, 0.35, 1.1, 2.9, 3.7, 6.2, 9.4];
const EDGE_TIMES = [0, 0.4, 1.3];
const LOOK = [2.5, -1.5] as const;

/**
 * Every picture of her that the fixture pins, in groups: all of her in each act
 * and on each side, at the moment that shows the act best and at seven others;
 * each face in a tile and over an edge, on each side; each act over an edge;
 * and a few single pictures for a face, a look, and a bare window.
 */
export const CASES: Readonly<Record<string, readonly Options[]>> = {
  ...Rec.fromEntries(
    Arr.flatMap(ActSchema.literals, (act) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `whole.${act}.${side}`,
        [
          { act, side, whole: true },
          ...Arr.map(TIMES, (t): Options => ({ act, side, t, whole: true })),
        ],
      ])
    )
  ),
  ...Rec.fromEntries(
    Arr.flatMap(MoodSchema.literals, (mood) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `tile.${mood}.${side}`,
        [
          ...Arr.map(
            LEANS,
            (lean): Options => ({ lean, mood, side, tile: "cream" })
          ),
          { lean: "peek", mood, side, tile: "yellow" },
        ],
      ])
    )
  ),
  ...Rec.fromEntries(
    Arr.flatMap(EdgeSchema.literals, (act) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `edge.${act}.${side}`,
        [
          { act, lean: "peek", side },
          ...Arr.map(
            EDGE_TIMES,
            (t): Options => ({ act, lean: "peek", side, t })
          ),
        ],
      ])
    )
  ),
  "single.whole": [{ whole: true }],
  "single.whole.shy": [{ act: "relaxed", mood: "shy", whole: true }],
  "single.whole.look": [{ act: "relaxed", look: LOOK, whole: true }],
  "single.whole.look.left": [
    { act: "relaxed", look: LOOK, side: "left", whole: true },
  ],
  "single.reading.look": [{ act: "reading", look: LOOK, t: 1.1, whole: true }],
  "single.juggling.look.left": [
    { act: "juggling", look: LOOK, side: "left", t: 2.9, whole: true },
  ],
  "single.tile.look": [{ lean: "right", look: LOOK, tile: "blue" }],
  "single.tile.look.left": [
    { lean: "left", look: LOOK, side: "left", tile: "green" },
  ],
  "single.tile.bare": [{ lean: "center" }],
  "single.tile": [{}],
  "single.peek.mood": [{ lean: "peek", mood: "curious", t: 0.7 }],
  "single.peek.look": [{ act: "greeting", lean: "peek", look: LOOK, t: 0.3 }],
};

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

/**
 * The digest of one picture: the SHA-256 of its window and its shapes, written
 * as JSON, cut to 12 hexadecimal digits.
 */
export const digestOf = Effect.fn("nina.digestOf")(function* (
  options: Options
) {
  const text = yield* encodeJson(scene(options));
  return Str.slice(0, 12)(yield* sha256Hex(text));
});

/**
 * The digest of each picture in each group of `CASES`, in order, with a space
 * between them. They were made after the pictures were proven equal, one by
 * one, to the SVG of the approved design, and they keep her from drifting from
 * it. When she is meant to change, the design changes first, and the new
 * pictures are proven against it before new digests are written.
 */
export const DIGESTS: Readonly<Record<string, string>> = {
  "edge.drumming.left": "b4a410c4bc95 efe4e12f4f5d 5e21cf36b2ef 4082addb9cae",
  "edge.drumming.right": "0edc9430cb95 8d17c4e552a2 f7d7901246fc dd7e4464c8be",
  "edge.greeting.left": "def8598c8ae2 244acdd4d78e 0d503ea33269 21b730c4079b",
  "edge.greeting.right": "a625cc5abcd0 df3fa84461f8 278034aa6f72 a51d99ec2be1",
  "edge.gripping.left": "3b172d45159d 43b219ca612d f12285ec088b 469feb5c8fa2",
  "edge.gripping.right": "a0e214659afe f3ca4e026854 33368db6d23c 952dc4fd2314",
  "single.juggling.look.left": "81fc152c1c90",
  "single.peek.look": "c831971c0dba",
  "single.peek.mood": "bdb3937d700b",
  "single.reading.look": "064d7cfa93b5",
  "single.tile": "a7819d6451d2",
  "single.tile.bare": "a7819d6451d2",
  "single.tile.look": "bb85bcd01dbd",
  "single.tile.look.left": "0fb9ad9c0205",
  "single.whole": "2cbc40cef0e2",
  "single.whole.look": "dcf8e2f618bc",
  "single.whole.look.left": "64ddef28f7e8",
  "single.whole.shy": "59ac72dbdc4a",
  "tile.aha.left": "49e976ddd66c 997dcbf1180e 28f850899bb0 6b89c21358a6",
  "tile.aha.right": "31ca9d1dc457 aa835b96086b ad5a5ca1b07e 337fb94e6bb4",
  "tile.asleep.left": "24a76f1608f4 8482129ddeb9 57faec48d6b6 5fec0f98f713",
  "tile.asleep.right": "d3b27f038d9a 8a7d88cf38a3 12bb0f82d8d0 2f48aea80dbf",
  "tile.calm.left": "3e911967b8c6 64a7961905a4 44c52b97f4fc e45efcbaa65d",
  "tile.calm.right": "ba29573d2e5d f9e944e3d77f 67e5ec841209 8d1d6609ded3",
  "tile.confused.left": "6b3a1d5147c6 3c9fdd529016 2be10c14086c a6abf8810b64",
  "tile.confused.right": "3736d02897d0 302487368ed3 9dfee14c1a2f a2c3cd6f0864",
  "tile.curious.left": "b356f4286a05 e48952df85c9 45a0fcdb7402 706ed9030c14",
  "tile.curious.right": "6969cfb6a849 246fa2383f0e 2fa6cea46629 618980a09bee",
  "tile.focused.left": "c65d4d9cd8f1 7fbc9e4879de 406ebba519a8 a064fdf30429",
  "tile.focused.right": "082c920d4843 28a63bea9eea c2e5a096b7de 1b200a14c145",
  "tile.happy.left": "4b9e3a358820 06790d31e820 1a225c9ff072 aac9d256c19d",
  "tile.happy.right": "465820feed62 fd1402cd838c 288a7c3ff75d 4f9d2fb0bc40",
  "tile.hello.left": "b5223e1cdd76 5550dac35b42 cbea5d9b16ae 2f5b9a5a5fbb",
  "tile.hello.right": "3327c92a80c5 15417ab9d7c0 dd07d607effc ea7472ced3af",
  "tile.laughing.left": "ceb06a0905b2 2b97aa286fd8 33faf578024c 3a3c43736bc4",
  "tile.laughing.right": "4e7269a55b7e 4e0cc2d68ad4 97a1c4792b06 01babf62b966",
  "tile.proud.left": "b57ded7bd705 d00e608bfe1a dcb998e50a1a 8087d79e41a5",
  "tile.proud.right": "6f797e6b2581 eb7b80ca0afc f1e2b0cac534 7286e281bddb",
  "tile.sad.left": "80866a73e32c 3c04ef563fb6 08a3a4747a10 8e04846b4af0",
  "tile.sad.right": "83b1e920dbff 78bb32001cec bd0fabb6d73d c57a5f4dcb32",
  "tile.shy.left": "efb7b4c450d6 e0110a419fbd ce84b7d46dfb 151afcdd1b63",
  "tile.shy.right": "af8464ea2855 a890a1a228af f4a23fa1a236 51386c19e617",
  "tile.surprised.left": "b3e0490b5fe0 45b312be43fd 53ee1acffe15 1a86e8085df7",
  "tile.surprised.right": "92ab161b2252 85fe9678549f 455b21cfecdf 8aece92bb1d7",
  "tile.thoughtful.left": "a879951465af 0c485689bead b06673b0ada4 2c4298e957e2",
  "tile.thoughtful.right":
    "fca3328409ba aa846dd6c7b7 e99674cb6752 1dea1556e649",
  "tile.winking.left": "fcd22fdebc0c a16e77e6a5a9 d99993d1de0c ba1edee09fa7",
  "tile.winking.right": "6070fc2b6fa0 6a50450b9619 01b6393f8552 2c6b839e9060",
  "whole.cheering.left":
    "bfa5d890e563 b283d739096b bfa5d890e563 f7fbb93526d3 e5da97219d1b fe3e03b19d70 426f6f4e9a33 534ebecb77e6",
  "whole.cheering.right":
    "b55206597a9f a4de252cb852 b55206597a9f 56c676d51a0a 8be5bbc271ac a1375afeab37 f72b66075598 dbb48bb80a7c",
  "whole.guarding.left":
    "7a0c776b5c86 e8d440ef77db b4d1f0777907 0bf4c9aea972 1361edaf25b1 fadadbc66dad 84667164cc01 66f4ea39013e",
  "whole.guarding.right":
    "d36e25c07206 73954283a63b 1d08a36cabf9 78df299ed639 2725512b1ecc 6a52aa23255b d9309918e421 a94efb3c48ca",
  "whole.hanging.left":
    "725785352d52 af73f7767a52 4b0e3cc1230e 281ec32b37b5 9793f0899200 e8110bb56433 a2f037a35582 ae049689fcbb",
  "whole.hanging.right":
    "eff224669789 750f2c1ff4a5 50b70a301b94 4201c7e27271 b6ac4753927c ee54e26fa175 431bf15413a2 88db326e6c9b",
  "whole.juggling.left":
    "52d1927b4d40 4cf55138ebdb c6757e8654df 84588039aab8 81fc152c1c90 59b0ec469624 20c32784005b a13c30b6df7f",
  "whole.juggling.right":
    "437f09ba529d 0ba4fdf64a20 197ef6c8c1f0 b9a3c8953863 38c6801fe47b f4c6c54d714a d6283d5024cc cf47708a78c1",
  "whole.pointing.left":
    "851bdd7a5cb2 e90b8620918d c2d30fca4154 bbd847bc89d1 739f432df45e 9653b6304cdb 3cd9df232217 3775ad538330",
  "whole.pointing.right":
    "09a7d9e6a5d0 0c29c9cf9609 b31a48767d3d 8310ec99b4f8 591ffc180271 8c22379d3509 1af8eafbb9e6 4f68b727e698",
  "whole.reading.left":
    "940690feb267 f2057b2070be e1a6610031c4 6c1c3fba869d 8c4b1727a398 5c009afc4756 9e106ed153b9 52f64717c472",
  "whole.reading.right":
    "0f1eb087a887 76b320af5e94 95a2f417e821 064d7cfa93b5 9e88bc79663f 84675b337653 e20f3e0e2f45 be7e430c841b",
  "whole.relaxed.left":
    "5a81f615d505 df4378f0d1e0 4b86319b3e99 024e558ecb8c b40595784c30 4f589fcd6a97 6e2e7cf0fbdf 3e2a8fb3556f",
  "whole.relaxed.right":
    "2cbc40cef0e2 497729454a9d 995f2f9b2e14 c99361c22793 007b2bf2c923 8f9bd8fd6125 2a851442b1f8 64e48781a679",
  "whole.searching.left":
    "9c2d2458333f 1658293ff4a5 263ab374312a c1c47f188acb 4683c3eb2b10 f024aec103e7 ba1559178623 8979b23d30ea",
  "whole.searching.right":
    "526b6a5b9374 c6cd8d81e58c 87d9fb9a116e 2d7eb42d8ec4 0c1663df04dd 966519b9138f 52ede05398bd 0f0195fc2d21",
  "whole.sleeping.left":
    "146e16699cf8 06575c4116ac 2f0108a29cdb 16da113a5435 5ab5589e56fd 908f25e1af77 0f03c054d74a 731853bc8702",
  "whole.sleeping.right":
    "9346c5dfa0a3 0d4874259b6a 6fe2da81ac3c 098eaabe63ff 44277efbf057 3a1221cc2501 2d9355a00b7e b1066fed1af3",
  "whole.thinking.left":
    "6742757ddb5b 3912db56fa23 2c66d81f1095 36a87f2994c8 d130ca7b03db cdbcdfcb525f 962e1cecfdba 5d496a0a3b3b",
  "whole.thinking.right":
    "e8cf7a45ec92 785bcd81cc62 a1ebc3b9ad6e 9a2031330650 e5376776acd1 82ce5dea232c 2a72221e7f7f 613960d46829",
  "whole.typing.left":
    "692469250b44 25bf8d691278 86ad3e124742 097343d65cf7 75ba06f52095 cd5e8a5c38f2 aacbae7c242b c56f944a8f5b",
  "whole.typing.right":
    "3aa842e95f92 b658f1dd2d55 5cfc249f045b ba8b04a9a627 b5db45c30852 e5256c44cbc2 f9c0803dc18e a953e72355ab",
  "whole.waving.left":
    "0fe7412fedb0 afe1275c604e bea00d3d12db 556e70c613d2 67f03d285a4f 83040270fc0b a060cf6e828e 228dfa3479e2",
  "whole.waving.right":
    "631a01068ce3 5d2db4b1d1e7 9408c7e37275 cc1c4fc22b20 e7c847b8cdfb 67e80672e0c0 bda2ad8f1062 bbf79ea2ea42",
  "whole.writing.left":
    "00bcbbb94825 55c2163c9f05 a46e083de21b 466f598afb77 e687afbf1ff7 44f82df59f12 e3c0dc79490d 70d880c4c2ef",
  "whole.writing.right":
    "6239ad90f7cb fa598272d396 41801809ebb0 8b53097aba19 413f2bfd6fcb 3324bc2bf88d 6e9a593aba13 1b3694aa5ec7",
};
