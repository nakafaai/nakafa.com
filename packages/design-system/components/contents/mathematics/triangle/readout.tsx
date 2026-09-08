"use client";

import { InlineMath } from "@repo/design-system/components/markdown/math";
import { TRIANGLE_SIDES } from "@repo/design-system/components/three/triangle/sides";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import { COLORS } from "@repo/design-system/lib/color";
import { getCos, getRadians, getSin, getTan } from "@repo/math/angles";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Connects the triangle's side symbols, authored names, and current angle. */
export function TriangleReadout({
  angle,
  labels,
}: {
  angle: number;
  labels: Record<(typeof TRIANGLE_SIDES)[number]["key"], ReactNode>;
}) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const formatRatio = (value: number) =>
    format
      .number(value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      })
      .replaceAll(",", "{,}");

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 px-6">
        {TRIANGLE_SIDES.map((side) => (
          <Badge key={side.key} style={{ color: side.color }} variant="outline">
            <InlineMath math={side.symbol} />: {labels[side.key]}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-6">
        <Badge variant="outline">
          <InlineMath
            math={`\\sin(${angle}^\\circ) \\approx ${formatRatio(getSin(angle))}`}
          />
        </Badge>
        <Badge variant="outline">
          <InlineMath
            math={`\\cos(${angle}^\\circ) \\approx ${formatRatio(getCos(angle))}`}
          />
        </Badge>
        <Badge variant="outline">
          {Number.isFinite(getTan(angle)) ? (
            <InlineMath
              math={`\\tan(${angle}^\\circ) \\approx ${formatRatio(getTan(angle))}`}
            />
          ) : (
            <>
              <InlineMath math={`\\tan(${angle}^\\circ)`} />: {t("undefined")}
            </>
          )}
        </Badge>
      </div>

      <Separator />

      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-6">
        <Badge style={{ color: COLORS.VIOLET }} variant="outline">
          <InlineMath math={`${angle}^\\circ`} />
        </Badge>{" "}
        <Badge className="font-mono" variant="outline">
          {format.number(getRadians(angle), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false,
          })}{" "}
          {t("radian")}
        </Badge>
      </div>
    </>
  );
}
