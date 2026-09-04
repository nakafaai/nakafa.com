import { assert, describe, it } from "@effect/vitest";
import {
  renderWelcomeEmail,
  Welcome,
  WelcomeEmailRenderError,
} from "@repo/email/templates/welcome";
import { Effect } from "effect";

describe("retiring welcome email contract", () => {
  const props = {
    name: "PRIVATE_MARKER_MUST_NOT_RENDER",
    privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
    startLearningUrl: "https://nakafa.com/en",
    termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
  };

  it.effect("never renders the legacy name field", () =>
    Effect.gen(function* () {
      const message = yield* renderWelcomeEmail(props);

      assert.ok(!message.html.includes(props.name));
      assert.ok(!message.text.includes(props.name));
      assert.ok(message.html.includes("Your Nakafa account is ready"));
      assert.ok(message.text.includes("Tryout"));
    })
  );

  it("maps the legacy preview contract without its name field", () => {
    const element = Welcome(props);

    assert.strictEqual(element.props.locale, "en");
    assert.ok(!Object.hasOwn(element.props, "name"));
  });

  it.effect("keeps renderer failures inside the legacy typed channel", () =>
    Effect.gen(function* () {
      const error = yield* renderWelcomeEmail({
        ...props,
        startLearningUrl: "not-a-url",
      }).pipe(Effect.flip);

      assert.ok(error instanceof WelcomeEmailRenderError);
      assert.strictEqual(error.code, "WELCOME_EMAIL_RENDER_FAILED");
    })
  );
});
