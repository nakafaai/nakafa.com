import {
  type Exponential,
  resolveExponential,
} from "@repo/design-system/components/contents/mathematics/exponential";
import { ExponentialPlot } from "@repo/design-system/components/contents/mathematics/exponential/client";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardTable,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Effect } from "effect";
import type { ReactNode } from "react";
import { useFormatter } from "use-intl";

const DECIMAL_OR_GROUP_SEPARATOR = /[,.]/gu;

function numberMath(value: number, format: (value: number) => string) {
  const rounded = Number(value.toPrecision(10));
  const text = format(rounded).replace(DECIMAL_OR_GROUP_SEPARATOR, "{$&}");
  return `${rounded === value ? "" : "\\approx"}${text}`;
}

/** Composes an exact model curve, discrete observations, and accessible values. */
export function FunctionChart({
  a,
  p,
  n,
  mode,
  title,
  description,
}: Exponential & { title: ReactNode; description: ReactNode }) {
  const formatter = useFormatter();
  const formatNumber = (value: number) =>
    formatter.number(value, {
      maximumSignificantDigits: 10,
    });
  const coefficientMath = (value: number) =>
    formatter
      .number(value, { maximumSignificantDigits: 21, useGrouping: false })
      .replace(DECIMAL_OR_GROUP_SEPARATOR, "{$&}");
  const plot = Effect.runSync(resolveExponential({ a, p, n, mode }));
  const formula = `f(x)=${coefficientMath(p)}\\cdot(${coefficientMath(a)})^x`;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="p-(--card-spacing)">
        <ExponentialPlot {...plot} />
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
      <VisualCardTable>
        {/* At its own width, so a narrow card scrolls the values instead of cutting them. */}
        <Table className="w-max min-w-full">
          <TableCaption className="sr-only">
            <InlineMath math={formula} />
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <InlineMath math="x" />
              </TableHead>
              {Arr.map(plot.values, ({ x }) => (
                <TableHead key={x} scope="col">
                  <InlineMath math={String(x)} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableHead scope="row">
                <InlineMath math="f(x)" />
              </TableHead>
              {Arr.map(plot.values, ({ x, y }) => (
                <TableCell key={x}>
                  <InlineMath math={numberMath(y, formatNumber)} />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </VisualCardTable>
      <VisualCardFooter>
        <div className="flex justify-center">
          <InlineMath math={formula} />
        </div>
      </VisualCardFooter>
    </VisualCard>
  );
}
