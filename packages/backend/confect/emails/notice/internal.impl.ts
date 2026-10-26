import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionRunner,
  DatabaseReader,
  MutationCtx,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import spec from "@repo/backend/confect/emails/notice/internal.spec";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { schoolAddress } from "@repo/backend/confect/tenancy/address";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { Array as Arr, Effect, Layer, Option } from "effect";

/**
 * What the notice of one announcement says, and the addresses of its recipients:
 * the class's address on the school's host, in the language of the class's unit,
 * and the account address of each recipient who holds an account with a real
 * address. A removed announcement says nothing, so nothing is sent.
 */
const readInput = FunctionImpl.make(
  databaseSchema,
  spec,
  "readInput",
  Effect.fn("emails.notice.readInput")(function* ({ postId, recipients }) {
    const reader = yield* DatabaseReader;
    const post = yield* reader
      .table("classroomPosts")
      .get(postId)
      .pipe(Effect.option);
    if (Option.isNone(post)) {
      return null;
    }
    const klass = yield* reader
      .table("classes")
      .get(post.value.classId)
      .pipe(Effect.orDie);
    const tenant = yield* reader
      .table("tenants")
      .get(klass.tenantId)
      .pipe(Effect.orDie);
    const unit = yield* reader
      .table("tenantUnits")
      .get(klass.unitId)
      .pipe(Effect.orDie);
    const siteUrl = yield* readSiteUrl();
    const links = yield* resolveLegalLinks(
      yield* readPageCatalog().pipe(Effect.provide(publicationLayer)),
      unit.contentLanguage,
      siteUrl
    );
    const school = yield* schoolAddress(siteUrl, tenant.slug);
    const addresses = yield* Effect.forEach(recipients, (personId) =>
      Effect.gen(function* () {
        const person = yield* reader
          .table("tenantPeople")
          .get(personId)
          .pipe(Effect.orDie);
        if (person.account.state !== "claimed") {
          return Option.none();
        }
        const user = yield* reader
          .table("users")
          .get(person.account.userId)
          .pipe(Effect.orDie);
        return isLoginAddress(user.email)
          ? Option.none()
          : Option.some({ email: user.email, personId });
      })
    );
    return {
      addresses: Arr.getSomes(addresses),
      input: {
        classUrl: new URL(`/classes/${klass.slug}`, school).href,
        locale: unit.contentLanguage,
        privacyPolicyUrl: links.privacyPolicyUrl,
        termsOfServiceUrl: links.termsOfServiceUrl,
      },
    };
  })
);

/**
 * Hands the rendered notice to the mail provider, one message to each address.
 * The announcement and the recipient are the idempotency key, so a repeated run
 * sends each recipient one message.
 */
const enqueue = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueue",
  Effect.fn("emails.notice.enqueue")(function* ({
    addresses,
    postId,
    ...message
  }) {
    const ctx = yield* MutationCtx;
    yield* Effect.forEach(
      addresses,
      (address) =>
        sendMail(ctx, {
          ...message,
          from: EMAIL_FROM,
          idempotencyKey: `notice-email/${postId}/${address.personId}`,
          to: address.email,
        }).pipe(Effect.orDie),
      { discard: true }
    );
    return null;
  })
);

/**
 * Sends the notice of one announcement to one batch of its recipients: it reads
 * what to say, renders it once in the Node runtime, and hands it over. Email is a
 * notice and the inbox holds the announcement either way, so a failed render
 * fails this action, which Convex does not repeat, and sends nothing.
 */
const send = FunctionImpl.make(
  databaseSchema,
  spec,
  "send",
  Effect.fn("emails.notice.send")(function* ({ postId, recipients }) {
    const { runQuery } = yield* QueryRunner;
    const { runAction } = yield* ActionRunner;
    const { runMutation } = yield* MutationRunner;
    const found = yield* runQuery(refs.internal.emails.notice.internal.readInput, {
      postId,
      recipients,
    }).pipe(Effect.orDie);
    if (found === null || Arr.isReadonlyArrayEmpty(found.addresses)) {
      return null;
    }
    const message = yield* runAction(
      refs.internal.emails.notice.delivery.render,
      found.input
    ).pipe(Effect.orDie);
    yield* runMutation(refs.internal.emails.notice.internal.enqueue, {
      ...message,
      addresses: found.addresses,
      postId,
    }).pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readInput),
  Layer.provide(enqueue),
  Layer.provide(send),
  GroupImpl.finalize
);
