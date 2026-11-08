import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";
import { withReplier } from "@/components/tenant/classes/forum/repliers";

const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const personId = personOf("person-1");
const mascot = Schema.decodeSync(MascotCode)("cat.0.243e66.right.open");

/** A person of the class as the forum draws them. */
const faceOf = (id: string, name: string, nina = false) => ({
  id: personOf(id),
  mascot,
  name,
  nina,
  photo: null,
});

describe("withReplier", () => {
  it("puts the newest replier first, each once and Nina once, at most three", () => {
    const raka = faceOf("person-2", "Raka");
    const sari = faceOf("person-3", "Sari");
    const dewi = faceOf("person-4", "Dewi");
    const nina = faceOf("person-2", "Nina", true);
    expect(withReplier([raka, sari], sari)).toEqual([sari, raka]);
    expect(withReplier([raka, nina], { ...nina, id: personId })).toEqual([
      { ...nina, id: personId },
      raka,
    ]);
    expect(withReplier([raka, sari, dewi], nina)).toEqual([nina, raka, sari]);
    expect(withReplier([nina], raka)).toEqual([raka, nina]);
  });
});
