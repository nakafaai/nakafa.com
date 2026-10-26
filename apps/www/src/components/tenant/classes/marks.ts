import { Animal } from "@repo/mascot/animal";
import type { Mascot } from "@repo/mascot/code";
import { cast } from "@repo/mascot/seed";
import { Array as Arr, Order } from "effect";

/** How many animals the set holds, so one sidebar can list as many classes before an animal repeats. */
const ANIMALS = Animal.literals.length;

/**
 * Gives each class of one sidebar its animal mark, as the school switcher marks a school. The classes
 * take their animals in the order of their ids, each the first animal of its own seeded order that no
 * class before it took, so a class keeps its animal while the list holds the same classes, a class
 * added later takes a free one, and no two classes share an animal until the 65 run out. The classes
 * come back in the order they came in.
 */
export const withMarks = <A extends { readonly id: string }>(
  classes: readonly A[]
) => {
  const placed = Arr.map(classes, (klass, place) => ({ klass, place }));
  const byId = Arr.sort(
    placed,
    Order.mapInput(Order.String, (row: (typeof placed)[number]) => row.klass.id)
  );
  const marked = Arr.reduce(
    byId,
    {
      rows: Arr.empty<
        (typeof placed)[number] & { readonly mascot: typeof Mascot.Type }
      >(),
      taken: Arr.empty<typeof Animal.Type>(),
    },
    (state, row) => {
      // Past every animal, a new round starts, so the round in use always leaves one free.
      const round = Arr.takeRight(state.taken, state.taken.length % ANIMALS);
      const free = Arr.filter(
        cast(row.klass.id, ANIMALS),
        (mascot) => !Arr.contains(round, mascot.animal)
      );
      const mascot = Arr.getUnsafe(free, 0);
      return {
        rows: Arr.append(state.rows, { ...row, mascot }),
        taken: Arr.append(state.taken, mascot.animal),
      };
    }
  );
  return Arr.map(
    Arr.sort(
      marked.rows,
      Order.mapInput(
        Order.Number,
        (row: (typeof marked.rows)[number]) => row.place
      )
    ),
    ({ klass, mascot }) => ({ ...klass, mascot })
  );
};
