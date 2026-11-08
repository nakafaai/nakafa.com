import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  nextRepliers,
  replierPeople,
} from "@repo/backend/confect/classroom/forum/face";
import { threadTitle } from "@repo/backend/confect/classroom/forum/thread";
import { Schema, String as Str } from "effect";

const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const raka = personOf("person-raka");
const sari = personOf("person-sari");
const dewi = personOf("person-dewi");
const budi = personOf("person-budi");

describe("classroom/forum repliers", () => {
  it("keeps the newest repliers first, each once and Nina once, at most three", () => {
    const first = nextRepliers(undefined, { _tag: "person", id: raka });
    const second = nextRepliers(first, { _tag: "person", id: sari });
    const again = nextRepliers(second, { _tag: "person", id: raka });
    expect(again).toEqual([
      { _tag: "person", id: raka },
      { _tag: "person", id: sari },
    ]);
    const nina = nextRepliers(again, { _tag: "nina", askedBy: sari });
    const ninaAgain = nextRepliers(nina, { _tag: "nina", askedBy: raka });
    expect(ninaAgain).toEqual([
      { _tag: "nina", askedBy: raka },
      { _tag: "person", id: raka },
      { _tag: "person", id: sari },
    ]);
    expect(
      nextRepliers(nextRepliers(ninaAgain, { _tag: "person", id: dewi }), {
        _tag: "person",
        id: budi,
      })
    ).toEqual([
      { _tag: "person", id: budi },
      { _tag: "person", id: dewi },
      { _tag: "nina", askedBy: raka },
    ]);
    expect(replierPeople(ninaAgain)).toEqual([raka, raka, sari]);
  });
});

describe("classroom/forum thread titles", () => {
  const plain = { attachments: [], poll: null };

  it("takes the first line of the text, else the poll's question, else the first file's name, cut to 120 characters", () => {
    expect(threadTitle({ ...plain, text: "  Halo semua  \nBaris kedua" })).toBe(
      "Halo semua"
    );
    expect(
      threadTitle({
        ...plain,
        poll: { multiple: false, options: ["A", "B"], question: "Pilih satu" },
        text: "",
      })
    ).toBe("Pilih satu");
    expect(
      threadTitle({
        attachments: [
          {
            address: null,
            byteSize: 1,
            height: null,
            kind: "document",
            name: "Panduan.pdf",
            thumbnail: null,
            width: null,
          },
        ],
        poll: null,
        text: null,
      })
    ).toBe("Panduan.pdf");
    expect(threadTitle({ ...plain, text: "" })).toBe("");
    expect(threadTitle({ ...plain, text: Str.repeat(200)("x") })).toHaveLength(
      120
    );
  });
});
