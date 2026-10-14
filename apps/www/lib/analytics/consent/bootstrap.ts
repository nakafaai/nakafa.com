import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
} from "@repo/analytics/consent";
import { Schema } from "effect";

const JsonStringSchema = Schema.fromJsonString(Schema.String);

/** Writes one constant as a JavaScript string literal inside the script. */
const literal = (value: string) => Schema.encodeSync(JsonStringSchema)(value);

/**
 * The inline script that runs before the usage-data prompt paints. It marks the
 * document root when this browser already keeps a choice for the current notice,
 * and the prompt's class hides it from that point on.
 *
 * It only reads what the consent store writes: the anonymous decision, and the
 * signed-in choice marker. It never writes a decision. Blocked or malformed
 * storage leaves the prompt shown, as the store does.
 */
export const ANALYTICS_CONSENT_BOOTSTRAP_SCRIPT = `(function () {
  var notice = ${literal(ANALYTICS_CONSENT_NOTICE_VERSION)};
  try {
    var decided =
      localStorage.getItem(${literal(ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY)}) === notice;
    var record = localStorage.getItem(${literal(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)});
    if (!decided && record !== null) {
      decided = JSON.parse(record).noticeVersion === notice;
    }
    if (decided) {
      document.documentElement.setAttribute("data-analytics-consent", "decided");
    }
  } catch (error) {
    // Storage that cannot be read keeps the prompt shown.
  }
})();`;
