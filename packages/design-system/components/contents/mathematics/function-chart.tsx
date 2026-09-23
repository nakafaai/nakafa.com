import {
  type Exponential,
  resolveExponential,
} from "@repo/design-system/components/contents/mathematics/exponential";
import { ExponentialPlot } from "@repo/design-system/components/contents/mathematics/exponential/client";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Effect } from "effect";
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
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ExponentialPlot {...plot} />
        <Table>
          <TableCaption className="sr-only">
            <InlineMath math={formula} />
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <InlineMath math="x" />
              </TableHead>
              {plot.values.map(({ x }) => (
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
              {plot.values.map(({ x, y }) => (
                <TableCell key={x}>
                  <InlineMath math={numberMath(y, formatNumber)} />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="justify-center">
        <InlineMath math={formula} />
      </CardFooter>
    </Card>
  );
}
