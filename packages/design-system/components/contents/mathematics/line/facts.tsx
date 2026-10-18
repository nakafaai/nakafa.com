"use client";

import {
  formatInterval,
  intervalSeparator,
} from "@repo/design-system/components/contents/mathematics/interval";
import { useLineScene } from "@repo/design-system/components/contents/mathematics/line/context";
import { summarizeLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardFacts } from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Option } from "effect";
import { useFormatter, useLocale, useTranslations } from "next-intl";

/**
 * The readouts of a line scene in its footer: the interval that each axis spans,
 * and, when the lines reach into depth, the z axis and the number of curves.
 */
export function LineFacts() {
  const t = useTranslations("Common");
  const format = useFormatter();
  const locale = useLocale();
  const separator = intervalSeparator(locale);
  const { lines } = useLineScene();
  const summary = summarizeLines(lines);
  if (Option.isNone(summary)) {
    return null;
  }

  const { count, x, y, z } = summary.value;
  const formatNumber = (value: number) =>
    format.number(value, MATH_NUMBER_OPTIONS);

  return (
    <VisualCardFacts>
      <VisualFact
        label={<InlineMath math="x" />}
        value={<InlineMath math={formatInterval(x, formatNumber, separator)} />}
      />
      <VisualFact
        label={<InlineMath math="y" />}
        value={<InlineMath math={formatInterval(y, formatNumber, separator)} />}
      />
      {z.max > z.min ? (
        <>
          <VisualFact
            label={<InlineMath math="z" />}
            value={
              <InlineMath math={formatInterval(z, formatNumber, separator)} />
            }
          />
          <VisualFact
            label={t("curves")}
            value={format.number(count, MATH_NUMBER_OPTIONS)}
          />
        </>
      ) : null}
    </VisualCardFacts>
  );
}
