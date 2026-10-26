import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import {
  insertMention,
  keptMentions,
  matchPeople,
  mentionQuery,
  mentionSegments,
} from "@/components/tenant/classes/forum/mentions";

const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const raka = { id: personOf("raka"), name: "Raka Pratama" };
const rakaHadi = { id: personOf("raka-hadi"), name: "Raka Hadi Putra" };
const sari = { id: personOf("sari"), name: "Sari Wulandari" };
const ara = { id: personOf("ara"), name: "Tiara" };

describe("forum mentions", () => {
  it("reads the mention being typed only after a space, a line start, or the text start", () => {
    expect(mentionQuery("Halo @Rak", 9)).toEqual(
      Option.some({ query: "Rak", start: 5 })
    );
    expect(mentionQuery("@", 1)).toEqual(Option.some({ query: "", start: 0 }));
    expect(mentionQuery("Baris\n@Sa", 9)).toEqual(
      Option.some({ query: "Sa", start: 6 })
    );
    expect(mentionQuery("surel@contoh", 12)).toEqual(Option.none());
    expect(mentionQuery("Halo semua", 10)).toEqual(Option.none());
    expect(mentionQuery("@Raka\nlagi", 10)).toEqual(Option.none());
    expect(mentionQuery(`@${"a".repeat(41)}`, 42)).toEqual(Option.none());
  });

  it("matches names that start with the letters first, then names that hold them", () => {
    expect(matchPeople([ara, sari, raka], "ra")).toEqual([raka, ara]);
    expect(matchPeople([raka, sari], "")).toEqual([raka, sari]);
    expect(matchPeople([raka], "zz")).toEqual([]);
  });

  it("replaces the typed mention with the name and a space, and moves the caret after them", () => {
    expect(insertMention("Halo @Rak apa kabar", 5, 9, "Raka Pratama")).toEqual({
      caret: 19,
      text: "Halo @Raka Pratama  apa kabar",
    });
  });

  it("sends the picked mentions the text still holds, each once", () => {
    const picked = [
      { _tag: "person" as const, ...raka },
      { _tag: "person" as const, ...raka },
      { _tag: "person" as const, ...sari },
      { _tag: "everyone" as const },
      { _tag: "everyone" as const },
    ];
    expect(keptMentions("@Raka Pratama dan @everyone", picked)).toEqual([
      { _tag: "person", ...raka },
      { _tag: "everyone" },
    ]);
  });

  it("cuts a message into its text and the longest mention at each place", () => {
    expect(
      mentionSegments("Halo @Raka Hadi Putra dan @Raka Pratama, @everyone!", [
        { _tag: "person", ...raka },
        { _tag: "person", ...rakaHadi },
        { _tag: "everyone" },
      ])
    ).toEqual([
      { _tag: "text", at: 0, text: "Halo " },
      { _tag: "mention", at: 5, text: "@Raka Hadi Putra" },
      { _tag: "text", at: 21, text: " dan " },
      { _tag: "mention", at: 26, text: "@Raka Pratama" },
      { _tag: "text", at: 39, text: ", " },
      { _tag: "mention", at: 41, text: "@everyone" },
      { _tag: "text", at: 50, text: "!" },
    ]);
    expect(
      mentionSegments("@everyone, lalu @Raka Pratama", [
        { _tag: "person", ...raka },
        { _tag: "everyone" },
      ])
    ).toEqual([
      { _tag: "mention", at: 0, text: "@everyone" },
      { _tag: "text", at: 9, text: ", lalu " },
      { _tag: "mention", at: 16, text: "@Raka Pratama" },
    ]);
    expect(mentionSegments("Tanpa sebutan", [])).toEqual([
      { _tag: "text", at: 0, text: "Tanpa sebutan" },
    ]);
    expect(mentionSegments("", [])).toEqual([]);
  });
});
