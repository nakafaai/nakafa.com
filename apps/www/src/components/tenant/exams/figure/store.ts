import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import { Array as Arr, Option } from "effect";
import { createStore } from "zustand";
import {
  type FigureDraft,
  figureOf,
} from "@/components/tenant/exams/figure/draft";
import {
  freeName,
  newSlider,
  type SliderDraft,
} from "@/components/tenant/exams/figure/plane";
import {
  newShape,
  type ShapeDraft,
  type ShapeKind,
} from "@/components/tenant/exams/figure/shapes";

/**
 * The figure a dialog writes and the edits a teacher makes to it. Every edit lands at once, so the
 * preview follows each keystroke, and nothing is written to the text until the teacher saves.
 */
export interface FigureBuilder {
  /** Adds an object of a kind under the others, drawn where it starts. */
  readonly addShape: (kind: ShapeKind) => void;
  /** Adds a slider on the next free letter, or nothing once every letter is taken. */
  readonly addSlider: () => void;
  /** Changes fields of the figure itself. */
  readonly change: (fields: Partial<FigureDraft>) => void;
  /** Changes fields of one object. */
  readonly changeShape: (id: string, fields: Partial<ShapeDraft>) => void;
  /** Changes fields of one slider. */
  readonly changeSlider: (id: string, fields: Partial<SliderDraft>) => void;
  /** Adds a copy of one object right under it. */
  readonly copyShape: (id: string) => void;
  /** The figure as it stands. */
  readonly draft: FigureDraft;
  /** The figure the draft makes, or none while the contract refuses it. */
  readonly figure: Option.Option<FigureAttrs>;
  /** Removes one object. */
  readonly removeShape: (id: string) => void;
  /** Removes one slider. */
  readonly removeSlider: (id: string) => void;
  /**
   * The figure the preview draws: the one the draft makes, or the last one it made while a value is on its way,
   * so the picture never blinks out under a half-typed number.
   */
  readonly shown: Option.Option<FigureAttrs>;
}

/** The first id of a kind that no object of the figure holds, counting from one, such as `point-3`. */
const freeId = (
  shapes: readonly ShapeDraft[],
  kind: string,
  count = 1
): string =>
  Arr.some(shapes, (shape) => shape.id === `${kind}-${count}`)
    ? freeId(shapes, kind, count + 1)
    : `${kind}-${count}`;

/** Replaces the fields of the one item with an id. */
const changeOne = <Item extends { readonly id: string }>(
  items: readonly Item[],
  id: string,
  fields: Partial<Item>
) => Arr.map(items, (item) => (item.id === id ? { ...item, ...fields } : item));

/** Creates the builder of one dialog, from the figure it opens on. Each dialog creates its own, once. */
export const createFigureBuilder = (draft: FigureDraft) =>
  createStore<FigureBuilder>()((set) => {
    const update = (edit: (draft: FigureDraft) => Partial<FigureDraft>) =>
      set((state) => {
        const next = { ...state.draft, ...edit(state.draft) };
        const figure = figureOf(next);
        return {
          draft: next,
          figure,
          shown: Option.isSome(figure) ? figure : state.shown,
        };
      });
    const figure = figureOf(draft);
    return {
      addShape: (kind) =>
        update(({ shapes }) => ({
          shapes: Arr.append(
            shapes,
            newShape(kind, freeId(shapes, kind), shapes.length)
          ),
        })),
      addSlider: () =>
        update(({ sliders }) =>
          Option.match(freeName(sliders), {
            onNone: () => ({}),
            onSome: (name) => ({
              sliders: Arr.append(sliders, newSlider(name, name)),
            }),
          })
        ),
      change: (fields) => update(() => fields),
      changeShape: (id, fields) =>
        update(({ shapes }) => ({ shapes: changeOne(shapes, id, fields) })),
      changeSlider: (id, fields) =>
        update(({ sliders }) => ({ sliders: changeOne(sliders, id, fields) })),
      copyShape: (id) =>
        update(({ shapes }) => ({
          shapes: Arr.flatMap(shapes, (shape) =>
            shape.id === id
              ? [shape, { ...shape, id: freeId(shapes, shape.kind) }]
              : [shape]
          ),
        })),
      draft,
      figure,
      removeShape: (id) =>
        update(({ shapes }) => ({
          shapes: Arr.filter(shapes, (shape) => shape.id !== id),
        })),
      removeSlider: (id) =>
        update(({ sliders }) => ({
          sliders: Arr.filter(sliders, (slider) => slider.id !== id),
        })),
      shown: figure,
    };
  });
