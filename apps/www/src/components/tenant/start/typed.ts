import { Schema } from "effect";
import { createStore } from "zustand";
import {
  type StartDraft,
  suggestSlug,
  typedSlug,
} from "@/components/tenant/start/state";

/** The name and address the founder types, and whether the address was typed rather than suggested. */
const TypedState = Schema.Struct({
  edited: Schema.Boolean,
  name: Schema.String,
  slug: Schema.String,
});

/** What the founder types into the two fields of the first question. */
interface TypedActions {
  /** Takes a new name, and suggests the address from it until the founder types one. */
  readonly setName: (name: string) => void;
  /** Takes a typed address; an emptied address follows the name again. */
  readonly setSlug: (text: string) => void;
}

/** The typed name and address of one questionnaire, with its actions. */
export type TypedName = typeof TypedState.Type & TypedActions;

/**
 * Creates the typed name and address of one questionnaire, starting from the
 * saved draft. Each questionnaire creates its own, once.
 */
export const createTypedName = (draft: StartDraft) => {
  const name = draft?.name ?? "";
  const slug = draft?.slug ?? suggestSlug(name);
  return createStore<TypedName>()((set) => ({
    edited: slug !== suggestSlug(name),
    name,
    setName: (next) =>
      set((state) => ({
        name: next,
        slug: state.edited ? state.slug : suggestSlug(next),
      })),
    setSlug: (text) => {
      const typed = typedSlug(text);
      set({ edited: typed !== "", slug: typed });
    },
    slug,
  }));
};
