import type {
  FormulaParameter,
  FormulaReadout,
} from "@nakafa/aksara-contracts/math/formula/field";
import { parameterScope } from "@nakafa/aksara-contracts/math/formula/scope";
import { DrawnInlineMath } from "@repo/design-system/components/markdown/drawn";
import { PARAMETER_NAMES } from "@repo/design-system/components/three/names";
import { Slider } from "@repo/design-system/components/ui/slider";
import { VisualCardToolbar } from "@repo/design-system/components/visual/card";
import { Array as Arr, Option, Record as Rec } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import {
  createParameterStore,
  type ParameterStore,
} from "@/lib/content/renderer/client/base/visual/parameters";

const ParameterContext = createContext<{
  readonly labels: Readonly<Record<string, ReactNode>>;
  readonly parameters: readonly FormulaParameter[];
  readonly readouts: readonly FormulaReadout[];
  readonly store: ParameterStore;
} | null>(null);

/**
 * Gives one scene's sliders a store that starts at their authored values, and
 * the rich labels its sliders and readouts show.
 */
export function ParameterProvider({
  children,
  labels,
  parameters,
  readouts,
}: {
  readonly children: ReactNode;
  readonly labels: Readonly<Record<string, ReactNode>>;
  readonly parameters: readonly FormulaParameter[];
  readonly readouts: readonly FormulaReadout[];
}) {
  const [store] = useState(() =>
    createParameterStore(parameterScope(parameters))
  );
  return (
    <ParameterContext value={{ labels, parameters, readouts, store }}>
      {children}
    </ParameterContext>
  );
}

/** Reads the scene's sliders, their store, and the rich labels they show. */
export function useParameters() {
  const value = use(ParameterContext);
  if (!value) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("Sliders require ParameterProvider.");
  }
  return value;
}

/** The current value of every slider, the scope its formulas sample with. */
export function useParameterValues() {
  return useStore(useParameters().store, (state) => state.values);
}

/** The digits a slider's value shows, enough for its step. */
function digits(parameter: FormulaParameter) {
  const step = parameter.step ?? (parameter.max - parameter.min) / 100;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(step))));
}

/**
 * One slider: its rich label, or its name as math, its value, and the track
 * that moves it.
 */
function ParameterSlider({
  parameter,
}: {
  readonly parameter: FormulaParameter;
}) {
  const { labels, store } = useParameters();
  const value = useStore(store, (state) =>
    Option.getOrElse(
      Rec.get(state.values, parameter.name),
      () => parameter.value
    )
  );
  const move = useStore(store, (state) => state.move);
  const name = Option.getOrElse(
    Rec.get(PARAMETER_NAMES, parameter.name),
    () => ""
  );
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        {parameter.label === undefined ? (
          <DrawnInlineMath html={name} />
        ) : (
          labels[parameter.label]
        )}
        <span className="shrink-0 tabular-nums">
          {value.toFixed(digits(parameter))}
        </span>
      </div>
      <Slider
        aria-label={parameter.name}
        max={parameter.max}
        min={parameter.min}
        onValueChange={(next) => move(parameter.name, next)}
        step={parameter.step ?? (parameter.max - parameter.min) / 100}
        value={value}
      />
    </div>
  );
}

/** The toolbar of a scene's sliders, one for each formula parameter. */
export function ParameterSliders() {
  const { parameters } = useParameters();
  if (Arr.isReadonlyArrayEmpty(parameters)) {
    return null;
  }
  return (
    <VisualCardToolbar>
      {Arr.map(parameters, (parameter) => (
        <ParameterSlider key={parameter.name} parameter={parameter} />
      ))}
    </VisualCardToolbar>
  );
}
