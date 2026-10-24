import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";

/** The decimal separator that each locale writes in the physics visuals of the home page. */
export const decimalSeparators = {
  de: "comma",
  en: "dot",
  id: "comma",
} satisfies Record<ActiveAppLocaleCode, DecimalSeparator>;
