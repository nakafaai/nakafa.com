import { describe, expect, it } from "@effect/vitest";
import { Animal } from "@repo/mascot/animal";
import { Array as Arr } from "effect";
import { withMarks } from "@/components/tenant/classes/marks";

/** Classes with these ids, in this order. */
const classesOf = (ids: readonly string[]) =>
  Arr.map(ids, (id) => ({ id, name: `Class ${id}` }));

/** The animal of each class, by id. */
const animalsOf = (ids: readonly string[]) =>
  Arr.map(withMarks(classesOf(ids)), ({ id, mascot }) => [id, mascot.animal]);

const IDS = Arr.map(Arr.range(1, 12), (n) => `k${n}`);

describe("withMarks", () => {
  it("gives each class an animal no other class in the sidebar has, and keeps the classes in order", () => {
    const marked = withMarks(classesOf(IDS));
    expect(Arr.map(marked, ({ id, name }) => [id, name])).toEqual(
      Arr.map(IDS, (id) => [id, `Class ${id}`])
    );
    expect(
      Arr.dedupe(Arr.map(marked, ({ mascot }) => mascot.animal))
    ).toHaveLength(IDS.length);
  });

  it("keeps a class's animal whatever the order of the list, and when a class joins after it", () => {
    const animals = animalsOf(IDS);
    expect(animalsOf(Arr.reverse(IDS))).toEqual(Arr.reverse(animals));
    expect(Arr.take(animalsOf([...IDS, "z1"]), IDS.length)).toEqual(animals);
  });

  it("starts the animals again only once every animal marks a class", () => {
    const ids = Arr.map(
      Arr.range(1, Animal.literals.length + 1),
      (n) => `c${String(n).padStart(3, "0")}`
    );
    const animals = Arr.map(
      withMarks(classesOf(ids)),
      ({ mascot }) => mascot.animal
    );
    expect(Arr.dedupe(Arr.take(animals, Animal.literals.length))).toHaveLength(
      Animal.literals.length
    );
    expect(animals).toHaveLength(Animal.literals.length + 1);
  });
});
