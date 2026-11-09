import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

const LegalLabels = Schema.Struct({
  privacyPolicy: Schema.String,
  termsOfService: Schema.String,
  unsubscribe: Schema.String,
});

/** The names of the links in the footer of every Nakafa email: the two legal pages and the unsubscribe. */
export const legalLabels = {
  de: {
    privacyPolicy: "Datenschutzerklärung",
    termsOfService: "Nutzungsbedingungen",
    unsubscribe: "Abmelden",
  },
  en: {
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    unsubscribe: "Unsubscribe",
  },
  id: {
    privacyPolicy: "Kebijakan Privasi",
    termsOfService: "Syarat dan Ketentuan",
    unsubscribe: "Berhenti berlangganan",
  },
  ms: {
    privacyPolicy: "Dasar Privasi",
    termsOfService: "Terma Perkhidmatan",
    unsubscribe: "Berhenti langgan",
  },
} satisfies Record<AppLocaleCode, typeof LegalLabels.Type>;
