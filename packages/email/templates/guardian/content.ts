import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  EMAIL_COLORS,
  EMAIL_FONTS,
  EMAIL_LOGO_URL,
  EMAIL_SENDER,
} from "@repo/email/brand";
import { legalLabels } from "@repo/email/legal";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, pipe, Schema, String as Str } from "effect";

/**
 * What a guardian's sign-in email carries: the six-digit code and the locale of
 * its words. It names no school, no student, and no grade, because a code is the
 * one value an email may carry (ADR 0027, ADR 0034).
 */
export const GuardianCodeEmailInput = Schema.Struct({
  code: Schema.String.check(Schema.isPattern(/^\d{6}$/u)),
  locale: ActiveAppLocaleCodeSchema,
});

const guardianCodeCopy = {
  de: {
    body: "Gib diesen Code auf der Anmeldeseite für Eltern deiner Schule ein. Er gilt fünf Minuten.",
    ignore:
      "Wenn du keinen Code angefordert hast, kannst du diese E-Mail ignorieren.",
    reason:
      "Wir senden dir diese E-Mail, weil für diese Adresse ein Anmeldecode für Eltern angefordert wurde.",
    subject: "Dein Nakafa-Anmeldecode",
  },
  en: {
    body: "Enter this code on your school's parent sign-in page. It works for five minutes.",
    ignore: "If you did not ask for a code, you can ignore this email.",
    reason:
      "We sent this email because a parent sign-in code was asked for with this address.",
    subject: "Your Nakafa sign-in code",
  },
  id: {
    body: "Masukkan kode ini di halaman masuk orang tua di sekolahmu. Kodenya berlaku lima menit.",
    ignore: "Kalau kamu tidak meminta kode, abaikan saja email ini.",
    reason:
      "Kami mengirim email ini karena kode masuk orang tua diminta dengan alamat ini.",
    subject: "Kode masuk Nakafa kamu",
  },
  ms: {
    body: "Masukkan kod ini di halaman log masuk ibu bapa sekolah kamu. Kod ini sah selama lima minit.",
    ignore: "Jika kamu tidak meminta kod, abaikan e-mel ini.",
    reason:
      "Kami menghantar e-mel ini kerana kod log masuk ibu bapa telah diminta dengan alamat ini.",
    subject: "Kod log masuk Nakafa kamu",
  },
};

const { dark, light } = EMAIL_COLORS;

/** The dark theme of the layout, for the clients that follow the reader's theme. */
const DARK_STYLE = `@media (prefers-color-scheme:dark){.n-page{background-color:${dark.background}!important}.n-text{color:${dark.foreground}!important}.n-muted{color:${dark["muted-foreground"]}!important}.n-rule{border-color:${dark.border}!important}}`;

/** One line of the footer in the muted color, as the layout draws it. */
const footerLine = (content: string, top: number) =>
  `<p class="n-muted" style="margin:${top}px 0 0;font-size:12px;line-height:20px;color:${light["muted-foreground"]}">${content}</p>`;

/** A link of the footer, underlined in the muted color. */
const footerLink = (href: string, label: string) =>
  `<a class="n-muted" href="${href}" style="color:${light["muted-foreground"]};text-decoration:underline">${label}</a>`;

/**
 * The subject, plain text, and HTML of a guardian's sign-in email, in the one
 * layout of every Nakafa email: the mark, the subject, the message with the
 * code, and the footer with the reason, the sender, its address, the contact
 * address, and the legal links. It is written without React, because the code
 * is sent from the mutation that draws it, a code never travels through a
 * scheduled job's stored arguments, and the layout's Tailwind renders only
 * asynchronously. The words are fixed copy and the code holds digits only, so
 * the HTML needs no escaping.
 */
export function guardianCodeEmail(input: typeof GuardianCodeEmailInput.Type) {
  const copy = guardianCodeCopy[input.locale];
  const legal = legalLabels[input.locale];
  const privacy = new URL(`/${input.locale}/privacy-policy`, SITE_ORIGIN).href;
  const terms = new URL(`/${input.locale}/terms-of-service`, SITE_ORIGIN).href;
  const text = Arr.join(
    [
      copy.subject,
      copy.body,
      input.code,
      copy.ignore,
      copy.reason,
      `${EMAIL_SENDER.name}\n${EMAIL_SENDER.address}\n${EMAIL_SENDER.contact}`,
    ],
    "\n\n"
  );
  const html = Arr.join(
    [
      `<!doctype html><html lang="${input.locale}"><head><meta charset="utf-8"><meta content="width=device-width" name="viewport"><meta content="light dark" name="color-scheme"><meta content="light dark" name="supported-color-schemes"><title>${copy.subject}</title><style>${DARK_STYLE}</style></head>`,
      `<body style="margin:0;padding:0;font-family:${pipe(EMAIL_FONTS, Arr.join(","), Str.replaceAll('"', "'"))}">`,
      `<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr><td align="center">`,
      `<table border="0" cellpadding="0" cellspacing="0" class="n-page" role="presentation" style="max-width:448px;width:100%;background-color:${light.background}"><tr><td style="padding:32px 24px;text-align:center">`,
      `<img alt="Nakafa" class="n-rule" height="40" src="${EMAIL_LOGO_URL}" style="display:block;margin:0 auto;border:1px solid ${light.border};border-radius:6px" width="40">`,
      `<h1 class="n-text" style="margin:24px 0 0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.025em;color:${light.foreground}">${copy.subject}</h1>`,
      `<p class="n-text" style="margin:12px 0 0;font-size:16px;line-height:24px;color:${light.foreground}">${copy.body}</p>`,
      `<p class="n-text" style="margin:24px 0 0;font-size:32px;line-height:40px;font-weight:600;letter-spacing:8px;color:${light.foreground}">${input.code}</p>`,
      `<p class="n-muted" style="margin:24px 0 0;font-size:14px;line-height:20px;color:${light["muted-foreground"]}">${copy.ignore}</p>`,
      `<hr class="n-rule" style="margin:32px 0;border:0;border-top:1px solid ${light.border}">`,
      footerLine(copy.reason, 0),
      footerLine(EMAIL_SENDER.name, 12),
      footerLine(EMAIL_SENDER.address, 4),
      footerLine(
        footerLink(`mailto:${EMAIL_SENDER.contact}`, EMAIL_SENDER.contact),
        4
      ),
      footerLine(
        `${footerLink(privacy, legal.privacyPolicy)}&nbsp;&nbsp;&nbsp;&nbsp;${footerLink(terms, legal.termsOfService)}`,
        12
      ),
      "</td></tr></table></td></tr></table></body></html>",
    ],
    ""
  );
  return { html, subject: copy.subject, text };
}
