import type { GenericId } from "@confect/core";
import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { integrationAuthority } from "@repo/backend/confect/integrations/authority";
import { DeviceUnknown } from "@repo/backend/confect/integrations/errors";
import {
  DEVICE_INTERVAL,
  DEVICE_SECONDS,
  DEVICE_TOKEN_SECONDS,
  type DevicePoll,
  type DeviceStart,
  UserCode,
} from "@repo/backend/confect/integrations/schema";
import { storeToken } from "@repo/backend/confect/integrations/token";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { schoolAddress } from "@repo/backend/confect/tenancy/address";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { sha256Hex } from "@repo/utilities/digest";
import { issueToken } from "@repo/utilities/token";
import {
  Array as Arr,
  Clock,
  Crypto,
  Duration,
  Effect,
  Option,
  Schema,
  String as Str,
  Struct,
} from "effect";

/** The letters of a user code: consonants only, so no code spells a word (RFC 8628 section 6.1). */
const ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

/** The letters of one user code. */
const CODE_LETTERS = 8;

/** The settings page where the school's Admin authorizes a device. */
const VERIFY_PATH = "settings/clients";

/** Expired device authorizations one sweep deletes; a backlog takes more runs. */
const SWEEP_LIMIT = 200;

/** Draws one user code from a CSPRNG, one letter per random byte. */
const drawUserCode = Effect.fn("integrations.device.userCode")(function* () {
  const bytes = yield* (yield* Crypto.Crypto).randomBytes(CODE_LETTERS);
  return Arr.join(
    Arr.map(
      Arr.fromIterable(bytes),
      (byte) => ALPHABET[byte % ALPHABET.length] ?? ""
    ),
    ""
  );
}, Effect.provide(WebCryptoLayer));

/** Everything in a typed user code that is not a letter. */
const NOT_LETTERS = /[^a-z]/gi;

/** A typed user code as it is stored: its letters, without the dash or spaces, in capitals. */
const userCodeOf = (typed: string) =>
  Schema.decodeOption(UserCode)(
    Str.toUpperCase(Str.replaceAll(NOT_LETTERS, "")(typed))
  );

/**
 * Starts a device authorization for one school (RFC 8628 section 3.1): a device code that
 * only the device holds, stored as its digest, and a user code that the school's Admin
 * types on the school's clients page. An unknown school answers `unknown`.
 */
export const startDevice = Effect.fn("integrations.device.start")(function* (
  slug: typeof TenantSlug.Type
) {
  const tenant = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", slug))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(tenant) || tenant.value.status !== "active") {
    const unknown: typeof DeviceStart.Type = { outcome: "unknown" };
    return unknown;
  }
  const { hash, token: deviceCode } = yield* issueToken().pipe(Effect.orDie);
  const userCode = yield* drawUserCode().pipe(
    Effect.flatMap(Schema.decodeEffect(UserCode)),
    Effect.orDie
  );
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("integrationDevices")
    .insert({
      deviceCodeHash: hash,
      expiresAt: now + Duration.toMillis(Duration.seconds(DEVICE_SECONDS)),
      polledAt: 0,
      state: { status: "pending" },
      tenantId: tenant.value._id,
      userCode,
    })
    .pipe(Effect.orDie);
  const address = yield* readSiteUrl().pipe(
    Effect.flatMap((siteUrl) => schoolAddress(siteUrl, slug)),
    Effect.orDie
  );
  const started: typeof DeviceStart.Type = {
    deviceCode,
    expiresIn: DEVICE_SECONDS,
    interval: DEVICE_INTERVAL,
    outcome: "started",
    userCode,
    verificationUri: new URL(VERIFY_PATH, address).href,
  };
  return started;
});

/**
 * Answers one poll of a device code (RFC 8628 section 3.5): pending until the Admin
 * decides, `slow_down` when the device polls faster than the interval, `denied` or
 * `expired` once, and for an authorized device an access token of its client for the
 * REST API, after which the authorization is gone.
 */
export const pollDevice = Effect.fn("integrations.device.poll")(function* (
  deviceCode: string
) {
  const expired: typeof DevicePoll.Type = { outcome: "expired" };
  const deviceCodeHash = yield* sha256Hex(deviceCode).pipe(Effect.orDie);
  const found = yield* (yield* DatabaseReader)
    .table("integrationDevices")
    .index("by_deviceCodeHash", (query) =>
      query.eq("deviceCodeHash", deviceCodeHash)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(found)) {
    return expired;
  }
  const device = found.value;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const remove = writer
    .table("integrationDevices")
    .delete(device._id)
    .pipe(Effect.orDie);
  if (device.expiresAt <= now) {
    yield* remove;
    return expired;
  }
  if (device.state.status === "denied") {
    yield* remove;
    const denied: typeof DevicePoll.Type = { outcome: "denied" };
    return denied;
  }
  if (device.state.status === "authorized") {
    const client = yield* (yield* DatabaseReader)
      .table("integrationClients")
      .get(device.state.clientId)
      .pipe(Effect.orDie);
    yield* remove;
    if (client.status !== "active") {
      return expired;
    }
    const token = yield* storeToken(client, "api", DEVICE_TOKEN_SECONDS);
    const issued: typeof DevicePoll.Type = {
      expiresIn: DEVICE_TOKEN_SECONDS,
      outcome: "issued",
      token,
    };
    return issued;
  }
  const early =
    now - device.polledAt <
    Duration.toMillis(Duration.seconds(DEVICE_INTERVAL));
  yield* writer
    .table("integrationDevices")
    .replace(device._id, {
      ...Struct.omit(device, ["_creationTime", "_id"]),
      polledAt: now,
    })
    .pipe(Effect.orDie);
  const waiting: typeof DevicePoll.Type = {
    outcome: early ? "slow_down" : "pending",
  };
  return waiting;
});

/** The pending, unexpired device authorization of one school that a typed user code names. */
const pendingDevice = Effect.fn("integrations.device.pending")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  typed: string
) {
  const userCode = userCodeOf(typed);
  if (Option.isNone(userCode)) {
    return yield* new DeviceUnknown();
  }
  const found = yield* (yield* DatabaseReader)
    .table("integrationDevices")
    .index("by_tenantId_and_userCode", (query) =>
      query.eq("tenantId", tenantId).eq("userCode", userCode.value)
    )
    .first()
    .pipe(Effect.orDie);
  const now = yield* Clock.currentTimeMillis;
  if (
    Option.isNone(found) ||
    found.value.state.status !== "pending" ||
    found.value.expiresAt <= now
  ) {
    return yield* new DeviceUnknown();
  }
  return found.value;
});

/**
 * Authorizes a pending device of the school for one active client of it, as the school's
 * Admin: the device then reads as that client, and revoking or rotating the client ends
 * its token. The authorization is journaled on the client.
 */
export const authorizeDevice = Effect.fn("integrations.device.authorize")(
  function* (
    actor: typeof TenantActor.Type,
    client: Parameters<typeof integrationAuthority.record>[1],
    typed: string
  ) {
    const device = yield* pendingDevice(client.tenantId, typed);
    yield* (yield* DatabaseWriter)
      .table("integrationDevices")
      .replace(device._id, {
        ...Struct.omit(device, ["_creationTime", "_id"]),
        state: { clientId: client._id, status: "authorized" },
      })
      .pipe(Effect.orDie);
    yield* integrationAuthority.record(actor, client, {
      client: client._id,
      type: "integration.authorized",
    });
  }
);

/** Denies a pending device of the school, as its Admin; the device's next poll answers `denied`. */
export const denyDevice = Effect.fn("integrations.device.deny")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  typed: string
) {
  const device = yield* pendingDevice(tenantId, typed);
  yield* (yield* DatabaseWriter)
    .table("integrationDevices")
    .replace(device._id, {
      ...Struct.omit(device, ["_creationTime", "_id"]),
      state: { status: "denied" },
    })
    .pipe(Effect.orDie);
});

/** Deletes device authorizations that expired. */
export const sweepDevices = Effect.fn("integrations.device.sweep")(
  function* () {
    const now = yield* Clock.currentTimeMillis;
    const expired = yield* (yield* DatabaseReader)
      .table("integrationDevices")
      .index("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(SWEEP_LIMIT)
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      expired,
      (device) =>
        writer
          .table("integrationDevices")
          .delete(device._id)
          .pipe(Effect.orDie),
      { discard: true }
    );
    return null;
  }
);
