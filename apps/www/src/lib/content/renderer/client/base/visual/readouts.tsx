import {
  VisualCardFacts,
  VisualCardFooter,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr, Option } from "effect";
import { useFormatter } from "use-intl";
import { readoutValues } from "@/lib/content/renderer/client/base/visual/formula";
import {
  useParameters,
  useParameterValues,
} from "@/lib/content/renderer/client/base/visual/sliders";

/**
 * The values a scene shows under its picture, each next to its rich label,
 * read again whenever a slider moves. A value that is not finite shows a dash.
 */
export function MathReadouts() {
  const { labels, readouts } = useParameters();
  const scope = useParameterValues();
  const format = useFormatter();
  if (Arr.isReadonlyArrayEmpty(readouts)) {
    return null;
  }
  return (
    <VisualCardFooter>
      <VisualCardFacts>
        {Arr.map(readoutValues(readouts, scope), ({ key, value }) => (
          <VisualFact
            key={key}
            label={labels[key]}
            value={Option.match(value, {
              onNone: () => "-",
              onSome: (number) => format.number(number, "math"),
            })}
          />
        ))}
      </VisualCardFacts>
    </VisualCardFooter>
  );
}
