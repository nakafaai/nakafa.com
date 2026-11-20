import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import type {
  Energy,
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  barShare,
  firstLawTex,
  PROCESS_LAW,
  signOf,
  signTex,
  valueTex,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/ledger";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useFormatter } from "use-intl";

/**
 * What the lab reads out under the scene, in three parts the lab sets in its
 * footer: each state's pressure, volume and temperature, the energy bars, and
 * the rule the process keeps with the first law.
 */

/** State 1 or state 2 of the gas as one fact: its pressure, volume and temperature, one to a line. */
export function StateFact({
  index,
  label,
  state,
}: {
  readonly index: 1 | 2;
  readonly label: ReactNode;
  readonly state: GasState;
}) {
  const quantity = useQuantity();
  return (
    <VisualFactTabular
      label={label}
      value={
        <span className="flex flex-col gap-1">
          <InlineMath
            math={`p_${index} = ${quantity(state.pressure, "\\text{ kPa}", 1)}`}
          />
          <InlineMath
            math={`V_${index} = ${quantity(state.volume, "\\text{ L}", 2)}`}
          />
          <InlineMath
            math={`T_${index} = ${quantity(state.temperature, "\\text{ K}", 1)}`}
          />
        </span>
      }
    />
  );
}

/**
 * The energy of the process as three bars on the lab's one scale: the heat
 * Q that flows into the gas, the work W the gas does, and the change ΔU of
 * its internal energy. Each bar grows right of the zero line for an energy
 * the gas gains or gives as work, and left for one it loses, so the first
 * law, ΔU = Q − W, shows in their lengths. With `showValues` each bar reads
 * its number in joules; without it, only its sign.
 */
export function EnergyBars({
  energy,
  labels,
  scale,
  showValues,
}: {
  readonly energy: Energy;
  readonly labels: {
    readonly energy: string;
    readonly heat: ReactNode;
    readonly internal: ReactNode;
    readonly work: ReactNode;
  };
  readonly scale: number;
  readonly showValues: boolean;
}) {
  const format = useFormatter();
  const signed = (value: number) =>
    mathNumber(
      format.number(value, "math", {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      })
    );
  const rows = [
    {
      color: PLOT_COLORS.orange,
      label: labels.heat,
      symbol: "Q",
      value: energy.heat,
    },
    {
      color: PLOT_COLORS.teal,
      label: labels.work,
      symbol: "W",
      value: energy.work,
    },
    {
      color: PLOT_COLORS.violet,
      label: labels.internal,
      symbol: "\\Delta U",
      value: energy.internal,
    },
  ];

  return (
    <ul aria-label={labels.energy} className="flex flex-col gap-3">
      {Arr.map(rows, (row) => (
        <li className="flex flex-col gap-1.5" key={row.symbol}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0">{row.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <InlineMath
                math={
                  showValues
                    ? valueTex(row.symbol, row.value, scale, signed)
                    : signTex(row.symbol, row.value, scale)
                }
              />
            </span>
          </div>
          <div
            aria-hidden="true"
            className="bg-muted relative h-2.5 rounded-full"
          >
            <span
              className="absolute inset-y-0 rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{
                backgroundColor: row.color,
                width: `${barShare(row.value, scale) * 50}%`,
                ...(signOf(row.value, scale) < 0
                  ? { right: "50%" }
                  : { left: "50%" }),
              }}
            />
            <span className="bg-foreground/60 absolute -inset-y-1 left-1/2 w-px" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The rule the process keeps, with the first law under it, worked through with its numbers when `showValues` is set. */
export function ProcessLaw({
  energy,
  label,
  process,
  scale,
  showValues,
}: {
  readonly energy: Energy;
  readonly label: ReactNode;
  readonly process: GasProcess;
  readonly scale: number;
  readonly showValues: boolean;
}) {
  const format = useFormatter();
  const plain = (value: number) =>
    mathNumber(format.number(value, "math", { maximumFractionDigits: 1 }));
  return (
    <VisualFactTabular
      label={label}
      value={
        <span className="flex flex-col gap-1">
          <InlineMath math={PROCESS_LAW[process]} />
          <InlineMath
            math={
              showValues
                ? firstLawTex(energy, scale, plain)
                : "\\Delta U = Q - W"
            }
          />
        </span>
      }
    />
  );
}
