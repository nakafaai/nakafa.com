import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import { Array as Arr, Option, Result } from "effect";
import { createStore } from "zustand";
import { figureOf } from "@/components/tenant/exams/figure/form";
import type { GraphDraft } from "@/components/tenant/exams/figure/graph/draft";
import {
  figureDraftOf,
  previewOf,
} from "@/components/tenant/exams/figure/graph/draft";
import type { SliderDraft } from "@/components/tenant/exams/figure/graph/plane";
import {
  freeName,
  newSlider,
} from "@/components/tenant/exams/figure/graph/plane";
import type {
  ShapeDraft,
  ShapeKind,
} from "@/components/tenant/exams/figure/graph/shapes";
import { newShape } from "@/components/tenant/exams/figure/graph/shapes";

/**
 * The graph a dialog writes and the edits a teacher makes to it. Every edit lands at once, so the preview follows
 * each keystroke, and the dialog hears of each one; nothing is written to the text until the teacher saves.
 */
export interface GraphState {
  /** Adds an object of a kind under the others, drawn where it starts. */
  readonly addShape: (kind: ShapeKind) => void;
  /** Adds a slider on the next free letter, or nothing once every letter is taken. */
  readonly addSlider: () => void;
  /** Changes fields of the graph itself. */
  readonly change: (fields: Partial<GraphDraft>) => void;
  /** Changes fields of one object. */
  readonly changeShape: (id: string, fields: Partial<ShapeDraft>) => void;
  /** Changes fields of one slider. */
  readonly changeSlider: (id: string, fields: Partial<SliderDraft>) => void;
  /** Adds a copy of one object right under it. */
  readonly copyShape: (id: string) => void;
  /** The graph as it stands. */
  readonly draft: GraphDraft;
  /** The figure the graph makes, or none while the catalog refuses it. */
  readonly figure: Option.Option<FigureAttrs>;
  /** Removes one object. */
  readonly removeShape: (id: string) => void;
  /** Removes one slider. */
  readonly removeSlider: (id: string) => void;
  /**
   * The figure the preview draws: the one the draft draws, named or not, or the last one it drew while a value is
   * on its way, so the picture never blinks out under a half-typed number.
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

/** The figure a graph makes, as the catalog checks it, or none while the catalog refuses it. */
const figureOfGraph = (draft: GraphDraft) =>
  Result.getSuccess(figureOf(figureDraftOf(draft, "")));

/**
 * Creates the builder of one dialog, from the graph it opens on, telling `write` of every graph the teacher makes.
 * Each dialog creates its own, once.
 */
export const createGraphStore = (
  draft: GraphDraft,
  write: (draft: GraphDraft) => void
) =>
  createStore<GraphState>()((set, get) => {
    const update = (edit: (draft: GraphDraft) => Partial<GraphDraft>) => {
      set((state) => {
        const next = { ...state.draft, ...edit(state.draft) };
        const preview = previewOf(next);
        return {
          draft: next,
          figure: figureOfGraph(next),
          shown: Option.isSome(preview) ? preview : state.shown,
        };
      });
      write(get().draft);
    };
    const figure = figureOfGraph(draft);
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
      shown: previewOf(draft),
    };
  });
