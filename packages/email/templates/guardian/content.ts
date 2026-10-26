import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

/**
 * What a guardian's sign-in email carries: the six-digit code and the locale of
 * its words. It names no school, no student, and no grade, because a code is the
 * one value an email may carry (ADR 0027, ADR 0034).
 */
export const GuardianCodeEmailInput = Schema.Struct({
  code: Schema.String.check(Schema.isPattern(/^\d{6}$/)),
  locale: ActiveAppLocaleCodeSchema,
});

const guardianCodeCopy = {
  de: {
    body: "Gib diesen Code auf der Anmeldeseite für Eltern deiner Schule ein. Er gilt fünf Minuten.",
    ignore:
      "Wenn du keinen Code angefordert hast, kannst du diese E-Mail ignorieren.",
    subject: "Dein Nakafa-Anmeldecode",
  },
  en: {
    body: "Enter this code on your school's parent sign-in page. It works for five minutes.",
    ignore: "If you did not ask for a code, you can ignore this email.",
    subject: "Your Nakafa sign-in code",
  },
  id: {
    body: "Masukkan kode ini di halaman masuk orang tua sekolah Anda. Kode berlaku lima menit.",
    ignore: "Jika Anda tidak meminta kode, abaikan email ini.",
    subject: "Kode masuk Nakafa Anda",
  },
};

/**
 * The subject, plain text, and HTML of a guardian's sign-in email. The words are
 * fixed copy and the code holds digits only, so the HTML needs no escaping. It is
 * written without React, because the code is sent from the mutation that draws
 * it, and a code never travels through a scheduled job's stored arguments.
 */
export function guardianCodeEmail(input: typeof GuardianCodeEmailInput.Type) {
  const copy = guardianCodeCopy[input.locale];
  const text = `${copy.body}\n\n${input.code}\n\n${copy.ignore}`;
  const html = `<!doctype html><html lang="${input.locale}"><body style="margin:0;padding:24px;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0a0a0a"><p style="margin:0 0 16px;font-size:16px;line-height:24px">${copy.body}</p><p style="margin:0 0 16px;font-size:32px;line-height:40px;font-weight:600;letter-spacing:8px">${input.code}</p><p style="margin:0;font-size:14px;line-height:20px;color:#525252">${copy.ignore}</p></body></html>`;
  return { html, subject: copy.subject, text };
}
