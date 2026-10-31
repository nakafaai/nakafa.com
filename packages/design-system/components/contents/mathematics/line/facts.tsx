import {
  formatInterval,
  intervalSeparator,
} from "@repo/design-system/components/contents/mathematics/interval";
import { summarizeLines } from "@repo/design-system/components/contents/mathematics/line/resolve";
import type { ResolvedLine } from "@repo/design-system/components/contents/mathematics/line/spec";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardFacts } from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import type { Locale } from "@repo/internationalization/src/locale";
import { Option } from "effect";
import { createFormatter } from "use-intl/core";

/**
 * The readouts of a line scene in its footer: the interval that each axis spans,
 * and, when the lines reach into depth, the z axis and the number of lines. It
 * reads no context, so a lesson's card draws it on the server, where its math
 * stays: the card gets it as a finished node, and the browser loads no math
 * for it. `linesLabel` is the word for the number of lines in `locale`.
 */
export function LineFacts({
  lines,
  linesLabel,
  locale,
}: {
  lines: readonly ResolvedLine[];
  linesLabel: string;
  locale: Locale;
}) {
  const format = createFormatter({ locale });
  const separator = intervalSeparator(locale);
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
            label={linesLabel}
            value={format.number(count, MATH_NUMBER_OPTIONS)}
          />
        </>
      ) : null}
    </VisualCardFacts>
  );
}
