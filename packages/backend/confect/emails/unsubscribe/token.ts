import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Recipient } from "@repo/backend/confect/emails/unsubscribe/schema";
import { signUnsubscribe } from "@repo/backend/confect/identity/secret";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { matchesSecret } from "@repo/utilities/digest";
import { Config, Effect, Result, Schema, String as Str } from "effect";
import { Base64Url } from "effect/encoding";

/** A token that no Nakafa email carried: unsigned, signed for another recipient, or not a token at all. */
export class UnsubscribeTokenInvalid extends Schema.TaggedError<
  UnsubscribeTokenInvalid,
  { readonly brand: unique symbol }
>()("UnsubscribeTokenInvalid", {
  code: Schema.Literal("UNSUBSCRIBE_TOKEN_INVALID"),
  message: Schema.String,
}) {}

const RecipientJson = Schema.fromJsonString(Recipient);

/** The query parameter that carries the token on the page and on the one-click address. */
export const UNSUBSCRIBE_PARAM = "token";

/** The path on the Convex site that a mail client posts to when the reader presses its own unsubscribe button. */
export const UNSUBSCRIBE_POST_PATH = "/email/unsubscribe";

const invalid = () =>
  new UnsubscribeTokenInvalid({
    code: "UNSUBSCRIBE_TOKEN_INVALID",
    message: "The unsubscribe token is not one a Nakafa email carried.",
  });

/**
 * The token of one recipient: the recipient as Base64Url JSON, a period, and the keyed hash of that text
 * (`signUnsubscribe`). It names who reads the email and nothing else, and only the server can sign one.
 */
export const tokenOf = Effect.fn("emails.unsubscribe.tokenOf")(function* (
  recipient: typeof Recipient.Type
) {
  const payload = Base64Url.encode(
    yield* Schema.encodeEffect(RecipientJson)(recipient).pipe(Effect.orDie)
  );
  return `${payload}.${yield* signUnsubscribe(payload)}`;
});

/**
 * The recipient a token names, once its hash matches the one the server signs for its payload, compared reading
 * every byte (`matchesSecret`). Any other text fails with `UnsubscribeTokenInvalid`.
 */
export const readToken = Effect.fn("emails.unsubscribe.readToken")(function* (
  token: string
) {
  const [payload = "", signature = "", ...rest] = Str.split(".")(token);
  if (rest.length > 0) {
    return yield* invalid();
  }
  const signed = yield* signUnsubscribe(payload);
  if (!(yield* matchesSecret(signature, signed))) {
    return yield* invalid();
  }
  const json = yield* Result.match(Base64Url.decodeString(payload), {
    onFailure: () => Effect.fail(invalid()),
    onSuccess: Effect.succeed,
  });
  return yield* Schema.decodeEffect(RecipientJson)(json).pipe(
    Effect.mapError(invalid)
  );
});

/**
 * The page an email's footer link opens, in the email's language, where the reader confirms with a press. The link
 * never unsubscribes on its own, because mail scanners open links.
 */
export const unsubscribePage = Effect.fn("emails.unsubscribe.page")(function* (
  recipient: typeof Recipient.Type,
  locale: AppLocaleCode
) {
  const page = new URL(`/${locale}/unsubscribe`, yield* readSiteUrl());
  page.searchParams.set(UNSUBSCRIBE_PARAM, yield* tokenOf(recipient));
  return page.href;
}, Effect.orDie);

/**
 * The address on the Convex site that a mail client posts to for its own one-click button (RFC 8058), which
 * `sendMail` names in the message's `List-Unsubscribe` header.
 */
export const unsubscribePost = Effect.fn("emails.unsubscribe.post")(function* (
  recipient: typeof Recipient.Type
) {
  const post = new URL(
    UNSUBSCRIBE_POST_PATH,
    yield* Config.schema(Schema.URL, "CONVEX_SITE_URL")
  );
  post.searchParams.set(UNSUBSCRIBE_PARAM, yield* tokenOf(recipient));
  return { post: post.href };
}, Effect.orDie);

/** The address as suppressions hold it, so a stored address matches however the sender wrote it. */
export const suppressedAddress = (address: string) =>
  Str.toLowerCase(Str.trim(address));
