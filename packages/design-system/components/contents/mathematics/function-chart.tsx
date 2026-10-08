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
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Effect } from "effect";
import { getFormatter } from "next-intl/server";
import type { ReactNode } from "react";

const DECIMAL_OR_GROUP_SEPARATOR = /[,.]/gu;

function numberMath(value: number, format: (value: number) => string) {
  const rounded = Number(value.toPrecision(10));
  const text = format(rounded).replace(DECIMAL_OR_GROUP_SEPARATOR, "{$&}");
  return `${rounded === value ? "" : "\\approx"}${text}`;
}

/** Composes an exact model curve, discrete observations, and accessible values. */
export async function FunctionChart({
  a,
  p,
  n,
  mode,
  title,
  description,
}: Exponential & { title: ReactNode; description: ReactNode }) {
  const formatter = await getFormatter();
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
      <VisualCardBody className="space-y-6">
        <VisualCardScene>
          <ExponentialPlot {...plot} />
        </VisualCardScene>
        <Table>
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
      </VisualCardBody>
      <VisualCardFooter>
        <div className="flex flex-1 justify-center self-center">
          <InlineMath math={formula} />
        </div>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
