import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

const LegalLabels = Schema.Struct({
  privacyPolicy: Schema.String,
  termsOfService: Schema.String,
});

/** The names of the two legal links in the footer of every Nakafa email. */
export const legalLabels = {
  de: {
    privacyPolicy: "Datenschutzerklärung",
    termsOfService: "Nutzungsbedingungen",
  },
  en: {
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
  },
  id: {
    privacyPolicy: "Kebijakan Privasi",
    termsOfService: "Syarat dan Ketentuan",
  },
} satisfies Record<ActiveAppLocaleCode, typeof LegalLabels.Type>;
