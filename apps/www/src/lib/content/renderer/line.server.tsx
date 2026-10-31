import type { ArtifactLocale } from "@nakafa/aksara-contracts/locale";
import { LineFacts } from "@repo/design-system/components/contents/mathematics/line/facts";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import type { ComponentProps } from "react";
import { createTranslator } from "use-intl/core";
import { LineEquation } from "@/lib/content/renderer/client/mathematics/equation";
import { TAKES_LOCALE } from "@/lib/content/renderer/locale";

type Props = Omit<ComponentProps<typeof LineEquation>, "facts"> & {
  readonly locale: ArtifactLocale;
};

/**
 * A lesson's line-equation card. The scene and its controls are the client
 * card's, and the readouts of its footer are drawn here, when the lesson is
 * built, in the lesson's locale: their math is finished HTML, and the browser
 * loads no math for the card.
 */
async function LineEquationRenderer({ locale, ...props }: Props) {
  const messages = await loadLocaleMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "Common" });
  const config = Effect.runSync(
    resolveLineScene({
      cameraPosition: props.cameraPosition,
      cameraTarget: props.cameraTarget,
      data: props.data,
      showZAxis: props.showZAxis,
    })
  );
  return (
    <LineEquation
      {...props}
      facts={
        <LineFacts
          lines={config.lines}
          linesLabel={t("lines")}
          locale={locale}
        />
      }
    />
  );
}

/** The line-equation renderer of every domain that signs one, taking the lesson's locale. */
export const LineEquationServer = Object.assign(LineEquationRenderer, {
  [TAKES_LOCALE]: true,
});
