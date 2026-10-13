import { ActSchema } from "@repo/mascot/nina/act";
import { EdgeSchema } from "@repo/mascot/nina/edge";
import { MoodSchema } from "@repo/mascot/nina/face";
import { scene } from "@repo/mascot/nina/figure";
import type { Options } from "@repo/mascot/nina/options";
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
/** None of these is the moment that shows an act best, so no picture is pinned twice. */
const TIMES = [0, 0.55, 1.1, 2.9, 3.7, 6.2, 9.4];
const EDGE_TIMES = [0, 0.4, 1.3];
const LOOK = [2.5, -1.5] as const;

/**
 * Every picture of her that the fixture pins, in groups: all of her in each act
 * and on each side, at the moment that shows the act best and at seven others;
 * each face in a tile and over an edge, on each side; each act over an edge;
 * and a few single pictures for a face that beats the face of the act, a look
 * that the act lets her have, and a ground. Every picture is a different one.
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
  "single.whole.mood": [{ act: "waving", mood: "sad", whole: true }],
  "single.whole.shy": [{ act: "relaxed", mood: "shy", whole: true }],
  "single.whole.look": [{ act: "relaxed", look: LOOK, whole: true }],
  "single.whole.look.left": [
    { act: "relaxed", look: LOOK, side: "left", whole: true },
  ],
  "single.waving.look": [{ act: "waving", look: LOOK, t: 1.1, whole: true }],
  "single.cheering.look.left": [
    { act: "cheering", look: LOOK, side: "left", t: 2.9, whole: true },
  ],
  "single.tile.look": [{ lean: "right", look: LOOK, tile: "blue" }],
  "single.tile.look.left": [
    { lean: "left", look: LOOK, side: "left", tile: "green" },
  ],
  "single.tile.orange": [{ lean: "center", tile: "orange" }],
  "single.tile": [{}],
  "single.peek.mood": [{ lean: "peek", mood: "curious", t: 0.7 }],
  "single.peek.mood.act": [
    { act: "greeting", lean: "peek", mood: "sad", t: 0.3 },
  ],
  "single.peek.look": [{ act: "greeting", lean: "peek", look: LOOK, t: 0.3 }],
};

/** Every way to take one variation from each of two lists, put into one object. */
function mix<A extends object, B extends object>(
  first: readonly A[],
  second: readonly B[]
) {
  return Arr.cartesianWith(first, second, (a, b) => ({ ...a, ...b }));
}

/** What changes a still picture of her, apart from the act and the window: side, face, look and moment. */
const VARIATIONS = mix(
  [{}, { side: "left" }] as const,
  mix(
    [{}, { mood: "shy" }] as const,
    mix([{}, { look: LOOK }] as const, [{}, { t: 0.7 }] as const)
  )
);

/**
 * Every set of options that asks for her: each act of the whole figure, and
 * each act over an edge in each way she can stand there, with and without a
 * side, a face, a look, a moment and a ground. A test that holds for a still
 * picture and for her life holds for all of them.
 */
export const EVERY_OPTIONS: readonly Options[] = [
  ...Arr.flatMap(ActSchema.literals, (act) =>
    Arr.map(VARIATIONS, (rest): Options => ({ act, whole: true, ...rest }))
  ),
  ...Arr.flatMap(EdgeSchema.literals, (act) =>
    Arr.flatMap([...LEANS, "peek"] as const, (lean) =>
      Arr.map(
        mix(VARIATIONS, [{}, { tile: "blue" }] as const),
        (rest): Options => ({ act, lean, ...rest })
      )
    )
  ),
];

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
  "edge.drumming.left": "fff5483177d1 6f1dd9b86911 3d1f16a99414 5daaf36c8464",
  "edge.drumming.right": "ff86eb33494c 2d11ea98545c 3539c306bad1 c04cb7a0990d",
  "edge.greeting.left": "a64e233e9998 d71e9fc83277 42bc602569e9 8edcd69df986",
  "edge.greeting.right": "4937f5a5d586 ddc1635dafa7 b8a18ad0cb89 4558beaf1636",
  "edge.gripping.left": "3b172d45159d 43b219ca612d f12285ec088b 469feb5c8fa2",
  "edge.gripping.right": "a0e214659afe f3ca4e026854 33368db6d23c 952dc4fd2314",
  "single.cheering.look.left": "c2be2243c873",
  "single.peek.look": "e11b317756b9",
  "single.peek.mood": "bdb3937d700b",
  "single.peek.mood.act": "6068eec55198",
  "single.tile": "a7819d6451d2",
  "single.tile.look": "30b92a0494c7",
  "single.tile.look.left": "51807f9b56e5",
  "single.tile.orange": "a34fc74aa6be",
  "single.waving.look": "d8adbdb9156f",
  "single.whole.look": "dcf8e2f618bc",
  "single.whole.look.left": "64ddef28f7e8",
  "single.whole.mood": "fb87176520b3",
  "single.whole.shy": "59ac72dbdc4a",
  "tile.aha.left": "e2856e9f8b7f 910b64730e9a b8e0e6491a9f 8d70f6444d97",
  "tile.aha.right": "7723fb5c8668 786e67c72ee4 d72b2b1343d0 2f5959cf3202",
  "tile.asleep.left": "2f74f0962b4e c8ad82b81438 10f163c5656a 041ad30f78c2",
  "tile.asleep.right": "ef144a140175 65a2aa00f4ca ed6d67fc4799 5fa2ec12fcbb",
  "tile.calm.left": "4eff343fb465 1aa17df95baa 01dcac49226b 8c4f45c8137c",
  "tile.calm.right": "3332c47de579 a9bea4f24ebb fa10b2db0efb 1d5590f3bc78",
  "tile.confused.left": "8056de580a82 346477e4b827 282bbe7a7fc0 48433fa90f13",
  "tile.confused.right": "01c9b0f1367f de57f3987298 154fc35682e8 cccbc528a65f",
  "tile.curious.left": "fb2cca7b0411 b2ef36a4031a 3ba6f054de78 eda176fd838a",
  "tile.curious.right": "6e016d1f054b 10a103b31bb0 3fd948f31fdb 19dcd96e6a2a",
  "tile.focused.left": "8180dd7b9ac3 e31af1f33e43 4a2d2e776f3e 90809ade5016",
  "tile.focused.right": "2daa8be5f672 bf9257d5a1e3 cc15273b68f1 5b5e60cd1d76",
  "tile.happy.left": "114f04f58fb2 67c2832e49ce f94d7731a78e 919e612a9035",
  "tile.happy.right": "53a96738e889 bb7ac6d7ca10 ad77fc2aca78 79aae93e9041",
  "tile.hello.left": "a2b890bf2353 51101e25cc66 540704aec2c5 bff4525d80e8",
  "tile.hello.right": "4efa3c07fcc2 88f61f0b45cc 06ac3c02c57d 60856a61ec8b",
  "tile.laughing.left": "c2e4e845a80a 771d2e705204 2b4a97b041cc c0d5441774f4",
  "tile.laughing.right": "fe146a718549 0543dc9babb3 95682bda37ab 577afd9e7b6f",
  "tile.proud.left": "25a5d941eeb0 3751e438f893 2bb67b1c4a9b 8175ab518f51",
  "tile.proud.right": "1c97e382d322 63766bc93ece 036065575dd1 fe05c7cbafa1",
  "tile.sad.left": "21827a5eb0da 79aeabfeda25 6daabab3c431 3d875ad5e07f",
  "tile.sad.right": "3ef2bbc38c74 ca4225101082 77eadec3632b f89242ef2b59",
  "tile.shy.left": "ba1018ccda4b 69077d488463 4a0acfd0b158 73c644bb3d4c",
  "tile.shy.right": "82345e34e226 4c3801120e51 7c0c74376b5c 95988bc9b919",
  "tile.surprised.left": "a9d953c0bfcc 383f515d604a 2fc1cf6289ee 721d3dd3389a",
  "tile.surprised.right": "87b4497a222a 737cf8240f18 d57f3cfd0351 3b9b820307e1",
  "tile.thoughtful.left": "7ba6c504eb93 422105118318 3a579419aedf fa9d60ba3200",
  "tile.thoughtful.right":
    "9cb01eeaac91 112fc8dec9b8 5e29faa7865f f9b85fa16a64",
  "tile.winking.left": "e344a9fd1229 95b2f6739612 700482d22ab3 70e37018e4ec",
  "tile.winking.right": "14a2a1a088e4 f314ad6a925c 661dccbcffd5 d4d1d10cc94d",
  "whole.cheering.left":
    "bfa5d890e563 b283d739096b c9ceb9eddead f7fbb93526d3 e5da97219d1b fe3e03b19d70 426f6f4e9a33 534ebecb77e6",
  "whole.cheering.right":
    "b55206597a9f a4de252cb852 edcbd658c7a0 56c676d51a0a 8be5bbc271ac a1375afeab37 f72b66075598 dbb48bb80a7c",
  "whole.guarding.left":
    "7a0c776b5c86 e8d440ef77db d054c63e5b6a 0bf4c9aea972 1361edaf25b1 fadadbc66dad 84667164cc01 66f4ea39013e",
  "whole.guarding.right":
    "d36e25c07206 73954283a63b 731ecdce351d 78df299ed639 2725512b1ecc 6a52aa23255b d9309918e421 a94efb3c48ca",
  "whole.hanging.left":
    "ad53efc48a85 3793c6f66566 6be34056e91b 12f814d45eb4 135d9467ec89 6847ce5977c0 0615b6e80aae 429f4a1ff677",
  "whole.hanging.right":
    "aaab6f6105b0 d53d293cee14 f2f8f8d12c2c ca06d5f6f33b c44601761cfe dcce28e5dba1 bf500d1e35eb ad28de9ec320",
  "whole.juggling.left":
    "52d1927b4d40 4cf55138ebdb 515988f7dd72 84588039aab8 81fc152c1c90 59b0ec469624 20c32784005b a13c30b6df7f",
  "whole.juggling.right":
    "437f09ba529d 0ba4fdf64a20 b99aa57abe64 b9a3c8953863 38c6801fe47b f4c6c54d714a d6283d5024cc cf47708a78c1",
  "whole.pointing.left":
    "0063816d7a94 98f5457a0401 08afa603d1b3 383003ac3cc2 7ae339f62c13 34554cefb40e 9476b202cb49 42ac4b7921a7",
  "whole.pointing.right":
    "dee3049843de d3caae94999c d9fcdae96c20 66d93dbe3887 925101263d77 8511dc465f65 abe463d35a18 243f4d3f1cd8",
  "whole.reading.left":
    "940690feb267 f2057b2070be 693d66f8daf8 6c1c3fba869d 8c4b1727a398 5c009afc4756 9e106ed153b9 52f64717c472",
  "whole.reading.right":
    "0f1eb087a887 76b320af5e94 2c25579e925b 064d7cfa93b5 9e88bc79663f 84675b337653 e20f3e0e2f45 be7e430c841b",
  "whole.relaxed.left":
    "5a81f615d505 df4378f0d1e0 212528c79899 024e558ecb8c b40595784c30 4f589fcd6a97 6e2e7cf0fbdf 3e2a8fb3556f",
  "whole.relaxed.right":
    "2cbc40cef0e2 497729454a9d 44632de13412 c99361c22793 007b2bf2c923 8f9bd8fd6125 2a851442b1f8 64e48781a679",
  "whole.searching.left":
    "9c2d2458333f 1658293ff4a5 f69f71e84070 c1c47f188acb 4683c3eb2b10 f024aec103e7 ba1559178623 8979b23d30ea",
  "whole.searching.right":
    "526b6a5b9374 c6cd8d81e58c d12563ac96e2 2d7eb42d8ec4 0c1663df04dd 966519b9138f 52ede05398bd 0f0195fc2d21",
  "whole.sleeping.left":
    "146e16699cf8 06575c4116ac 564ea79eca43 16da113a5435 5ab5589e56fd 908f25e1af77 0f03c054d74a 731853bc8702",
  "whole.sleeping.right":
    "9346c5dfa0a3 0d4874259b6a 67856b180564 098eaabe63ff 44277efbf057 3a1221cc2501 2d9355a00b7e b1066fed1af3",
  "whole.thinking.left":
    "6742757ddb5b 3912db56fa23 ab590ab10c59 36a87f2994c8 d130ca7b03db cdbcdfcb525f 962e1cecfdba 5d496a0a3b3b",
  "whole.thinking.right":
    "e8cf7a45ec92 785bcd81cc62 6136be2d69c5 9a2031330650 e5376776acd1 82ce5dea232c 2a72221e7f7f 613960d46829",
  "whole.typing.left":
    "692469250b44 25bf8d691278 584e5251560c 097343d65cf7 75ba06f52095 cd5e8a5c38f2 aacbae7c242b c56f944a8f5b",
  "whole.typing.right":
    "3aa842e95f92 b658f1dd2d55 dbb9ef6c24bb ba8b04a9a627 b5db45c30852 e5256c44cbc2 f9c0803dc18e a953e72355ab",
  "whole.waving.left":
    "0fe7412fedb0 afe1275c604e 635ed6c69672 556e70c613d2 67f03d285a4f 83040270fc0b a060cf6e828e 228dfa3479e2",
  "whole.waving.right":
    "631a01068ce3 5d2db4b1d1e7 18e56ca61da6 cc1c4fc22b20 e7c847b8cdfb 67e80672e0c0 bda2ad8f1062 bbf79ea2ea42",
  "whole.writing.left":
    "00bcbbb94825 55c2163c9f05 54d6688063f1 466f598afb77 e687afbf1ff7 44f82df59f12 e3c0dc79490d 70d880c4c2ef",
  "whole.writing.right":
    "6239ad90f7cb fa598272d396 b7356a2cb9aa 8b53097aba19 413f2bfd6fcb 3324bc2bf88d 6e9a593aba13 1b3694aa5ec7",
};
