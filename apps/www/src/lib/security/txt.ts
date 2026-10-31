import { COMPANY_IDENTITY } from "@repo/seo/company";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, DateTime } from "effect";

/** Where security.txt lives in the build's output, which RFC 9116 fixes. */
export const SECURITY_TXT_PATH = ".well-known/security.txt";

/** How long a security.txt stays valid. RFC 9116 asks for less than a year, and every build renews it. */
const VALID_DAYS = 360;

/**
 * The security.txt of the site: how a researcher reaches Nakafa, as SECURITY.md
 * says. The build writes it with its own date, so it never expires while the site
 * ships.
 * @see https://www.rfc-editor.org/rfc/rfc9116
 */
export function renderSecurityTxt(now: DateTime.Utc) {
  return Arr.join(
    [
      `Contact: mailto:${COMPANY_IDENTITY.email}`,
      `Expires: ${DateTime.formatIso(DateTime.add(now, { days: VALID_DAYS }))}`,
      "Preferred-Languages: en, id",
      `Canonical: ${new URL(SECURITY_TXT_PATH, SITE_ORIGIN).href}`,
      "Policy: https://github.com/nakafaai/nakafa.com/security/policy",
      "",
    ],
    "\n"
  );
}
