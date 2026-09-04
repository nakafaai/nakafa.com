import { afterEach, assert, describe, it } from "@effect/vitest";
import type { AccountReadyEmailInput } from "@repo/email/templates/account-ready";
import {
  AccountReadyEmailInputError,
  AccountReadyEmailRenderError,
  renderAccountReadyEmail,
} from "@repo/email/templates/account-ready";
import { Effect } from "effect";

const renderState = vi.hoisted(() => ({ fail: false }));
const headingPattern = /<h1\b/g;
const paragraphMarginPattern = /margin:0(?:px)?/;
const presentationRolePattern = /role="presentation"/;

function encodeHtmlText(value: string) {
  return value.replaceAll("'", "&#x27;");
}

vi.mock("@react-email/render", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-email/render")>();

  return {
    ...actual,
    render: (...args: Parameters<typeof actual.render>) => {
      if (renderState.fail) {
        return Promise.reject(new Error("render unavailable"));
      }
      return actual.render(...args);
    },
  };
});

const localizedCases = [
  {
    body: "Your account is set up. Explore a subject or start a Tryout whenever you're ready.",
    cta: "Continue learning",
    footerReason: "We sent this email because you created a Nakafa account.",
    locale: "en",
    privacyPolicy: "Privacy Policy",
    subject: "Your Nakafa account is ready",
    termsOfService: "Terms of Service",
  },
  {
    body: "Akunmu sudah siap. Pilih mata pelajaran atau mulai try out kapan pun kamu siap.",
    cta: "Lanjut belajar",
    footerReason: "Kami mengirim email ini karena kamu membuat akun Nakafa.",
    locale: "id",
    privacyPolicy: "Kebijakan Privasi",
    subject: "Akun Nakafa kamu sudah siap",
    termsOfService: "Syarat dan Ketentuan",
  },
  {
    body: "Dein Konto ist eingerichtet. Wähle ein Fach oder starte einen Probetest, wenn du bereit bist.",
    cta: "Weiterlernen",
    footerReason:
      "Wir senden dir diese E-Mail, weil du ein Nakafa-Konto erstellt hast.",
    locale: "de",
    privacyPolicy: "Datenschutzerklärung",
    subject: "Dein Nakafa-Konto ist bereit",
    termsOfService: "Nutzungsbedingungen",
  },
] satisfies ReadonlyArray<{
  readonly body: string;
  readonly cta: string;
  readonly footerReason: string;
  readonly locale: AccountReadyEmailInput["locale"];
  readonly privacyPolicy: string;
  readonly subject: string;
  readonly termsOfService: string;
}>;

function accountReadyInput(
  locale: AccountReadyEmailInput["locale"]
): AccountReadyEmailInput {
  return {
    continueUrl: `https://nakafa.com/${locale}/home`,
    locale,
    privacyPolicyUrl: `https://nakafa.com/${locale}/privacy-policy`,
    termsOfServiceUrl: `https://nakafa.com/${locale}/terms-of-service`,
  };
}

afterEach(() => {
  renderState.fail = false;
});

describe("account-ready email", () => {
  for (const localized of localizedCases) {
    it.effect(`renders the complete ${localized.locale} message`, () =>
      Effect.gen(function* () {
        const input = accountReadyInput(localized.locale);
        const message = yield* renderAccountReadyEmail(input);
        const encodedBody = encodeHtmlText(localized.body);

        assert.strictEqual(message.subject, localized.subject);
        assert.match(
          message.html,
          new RegExp(`<title>${localized.subject}</title>`)
        );
        assert.match(
          message.html,
          new RegExp(`<h1[^>]*>${localized.subject}</h1>`)
        );
        const localeAttributes =
          message.html.match(new RegExp(`lang="${localized.locale}"`, "g")) ??
          [];
        assert.ok(localeAttributes.length >= 3);
        assert.ok(message.html.includes('dir="ltr"'));
        assert.strictEqual(message.html.match(headingPattern)?.length, 1);
        assert.ok(message.html.includes('alt="Nakafa"'));
        assert.ok(message.html.includes('src="https://nakafa.com/logo.png"'));
        assert.ok(message.html.includes(encodedBody));
        assert.ok(message.html.includes(localized.cta));
        assert.ok(message.html.includes(localized.footerReason));
        assert.ok(message.html.includes(localized.privacyPolicy));
        assert.ok(message.html.includes(localized.termsOfService));
        assert.ok(message.html.includes(`href="${input.continueUrl}"`));
        assert.ok(message.html.includes(`href="${input.privacyPolicyUrl}"`));
        assert.ok(message.html.includes(`href="${input.termsOfServiceUrl}"`));
        assert.ok(message.html.includes("box-sizing:border-box"));
        assert.ok(message.html.includes("border-top:1px solid"));
        assert.ok(Buffer.byteLength(message.html, "utf8") < 102_400);

        const paragraphs = message.html.match(/<p\b[^>]*>/g) ?? [];
        assert.ok(paragraphs.length > 0);
        for (const paragraph of paragraphs) {
          assert.match(paragraph, paragraphMarginPattern);
        }

        const tables = message.html.match(/<table\b[^>]*>/g) ?? [];
        assert.ok(tables.length > 0);
        for (const table of tables) {
          assert.match(table, presentationRolePattern);
        }

        assert.ok(
          message.text.includes(
            localized.subject.toLocaleUpperCase(localized.locale)
          )
        );
        assert.ok(message.text.includes(localized.body));
        assert.ok(message.text.includes(localized.cta));
        assert.ok(message.text.includes(localized.footerReason));
        assert.ok(message.text.includes(localized.privacyPolicy));
        assert.ok(message.text.includes(localized.termsOfService));
      })
    );
  }

  it.effect("never renders unexpected personal fields", () =>
    Effect.gen(function* () {
      const privateMarker = "Private Test Learner";
      const input = { ...accountReadyInput("en"), name: privateMarker };
      const message = yield* renderAccountReadyEmail(input);

      assert.ok(!message.html.includes(privateMarker));
      assert.ok(!message.text.includes(privateMarker));
    })
  );

  it.effect("accepts loopback HTTP for local verification", () =>
    Effect.gen(function* () {
      const message = yield* renderAccountReadyEmail({
        continueUrl: "http://localhost:3000/en/home",
        locale: "en",
        privacyPolicyUrl: "http://127.0.0.1:3000/en/privacy-policy",
        termsOfServiceUrl: "http://[::1]:3000/en/terms-of-service",
      });

      assert.ok(message.html.includes("http://localhost:3000/en/home"));
    })
  );

  it.effect("rejects malformed and external non-HTTPS links", () =>
    Effect.gen(function* () {
      for (const continueUrl of ["not-a-url", "http://nakafa.com/en/home"]) {
        const error = yield* renderAccountReadyEmail({
          ...accountReadyInput("en"),
          continueUrl,
        }).pipe(Effect.flip);

        assert.ok(error instanceof AccountReadyEmailInputError);
        assert.strictEqual(error.code, "ACCOUNT_READY_EMAIL_INPUT_INVALID");
      }
    })
  );

  it.effect("maps renderer failures to the typed error channel", () =>
    Effect.gen(function* () {
      renderState.fail = true;
      const error = yield* renderAccountReadyEmail(
        accountReadyInput("en")
      ).pipe(Effect.flip);
      renderState.fail = false;

      assert.ok(error instanceof AccountReadyEmailRenderError);
      assert.strictEqual(error.code, "ACCOUNT_READY_EMAIL_RENDER_FAILED");
    })
  );
});
