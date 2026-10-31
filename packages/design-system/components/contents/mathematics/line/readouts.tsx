"use client";

import { useLineScene } from "@repo/design-system/components/contents/mathematics/line/context";
import { LineFacts } from "@repo/design-system/components/contents/mathematics/line/facts";
import { useLocale, useTranslations } from "use-intl";

/**
 * The readouts of the surrounding card's scene, drawn in the browser in the
 * reader's locale. A question graph composes its card in a component of its
 * own, where the renderer gives no locale, so it draws its readouts here.
 */
export function LineReadouts() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const { lines } = useLineScene();
  return <LineFacts lines={lines} linesLabel={t("lines")} locale={locale} />;
}
