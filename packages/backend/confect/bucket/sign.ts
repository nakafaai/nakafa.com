import {
  Array as Arr,
  Clock,
  Config,
  DateTime,
  Effect,
  Layer,
  Order,
  Record as Rec,
  Redacted,
  Schema,
  String as Str,
} from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

/** The object methods Nakafa signs: an upload, a read, a size check, and a deletion. */
export const ObjectMethod = Schema.Literals(["GET", "PUT", "HEAD", "DELETE"]);

/**
 * The S3 credentials of one bucket and the endpoint that serves it. Production and the dev deployment read a
 * Cloudflare R2 bucket at `https://{account}.r2.cloudflarestorage.com`; local acceptance reads its own stand-in.
 * The region of R2 is always `auto`.
 */
const bucketConfig = Config.all({
  accessKeyId: Config.String("R2_ACCESS_KEY_ID"),
  bucket: Config.String("R2_BUCKET"),
  endpoint: Config.URL("R2_ENDPOINT"),
  secretAccessKey: Config.Redacted("R2_SECRET_ACCESS_KEY"),
});

/** The slashes that end an endpoint's path, which the bucket's path replaces. */
const TRAILING_SLASHES = /\/+$/u;

/** The region that every R2 bucket signs with. */
const R2_REGION = "auto";

/** What one presigned address names: its method, its object, how long it lives, and the headers and query it binds. */
const PresignRequest = Schema.Struct({
  accessKeyId: Schema.String,
  expiresSeconds: Schema.Int.check(
    Schema.isBetween({ maximum: 604_800, minimum: 1 })
  ),
  headers: Schema.Record(Schema.String, Schema.String),
  method: ObjectMethod,
  query: Schema.Record(Schema.String, Schema.String),
  region: Schema.String,
  secretAccessKey: Schema.Redacted(Schema.String),
  signedAt: Schema.Finite,
  url: Schema.URL,
});

/** RFC 3986 encoding, as SigV4 asks: `encodeURIComponent` leaves `!'()*` alone, which S3 encodes. */
const encodeStrict = (text: string) =>
  encodeURIComponent(text).replace(
    /[!'()*]/gu,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );

/** The canonical path: each segment encoded once, the slashes kept. */
const canonicalPath = (url: URL) =>
  Arr.join(
    Arr.map(Str.split(url.pathname, "/"), (segment) =>
      encodeStrict(decodeURIComponent(segment))
    ),
    "/"
  );

/** Encoded `name=value` pairs, sorted by their encoded name. */
const canonicalQuery = (query: Record<string, string>) =>
  Arr.join(
    Arr.map(
      Arr.sort(
        Arr.map(Rec.toEntries(query), ([name, value]) => [
          encodeStrict(name),
          encodeStrict(value),
        ]),
        Order.mapInput(Order.String, ([name]: readonly string[]) => name)
      ),
      ([name, value]) => `${name}=${value}`
    ),
    "&"
  );

const encoder = new TextEncoder();

/** The HMAC-SHA256 of a text under raw key bytes. */
const hmac = (key: Uint8Array, text: string) =>
  Effect.gen(function* () {
    const mac = yield* Mac.Mac;
    return yield* mac.sign(
      yield* Mac.key(Mac.hmacSha256, key),
      encoder.encode(text)
    );
  });

/**
 * Presigns one object request with AWS Signature Version 4 in the query string, as R2's S3 API accepts it
 * (https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html). Every header it binds must be
 * sent unchanged, so an upload that binds its length and type cannot store another size or another type. The
 * payload is unsigned, which presigned addresses always are. Signing makes no request.
 */
export const presign = Effect.fn("bucket.presign")(
  function* (request: typeof PresignRequest.Type) {
    const stamp = DateTime.formatIso(DateTime.makeUnsafe(request.signedAt));
    const amzDate = `${stamp.slice(0, 19).replace(/[-:]/gu, "")}Z`;
    const day = amzDate.slice(0, 8);
    const scope = `${day}/${request.region}/s3/aws4_request`;
    const headers = Rec.mapKeys(
      { ...request.headers, host: request.url.host },
      Str.toLowerCase
    );
    const names = Arr.sort(Rec.keys(headers), Order.String);
    const signedHeaders = Arr.join(names, ";");
    const query = canonicalQuery({
      ...request.query,
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${request.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(request.expiresSeconds),
      "X-Amz-SignedHeaders": signedHeaders,
    });
    const canonical = Arr.join(
      [
        request.method,
        canonicalPath(request.url),
        query,
        Arr.join(
          Arr.map(names, (name) => `${name}:${headers[name]?.trim()}\n`),
          ""
        ),
        signedHeaders,
        "UNSIGNED-PAYLOAD",
      ],
      "\n"
    );
    const digest = yield* Digest.Digest;
    const hashed = Hex.encode(
      yield* digest.digest(Digest.sha256, encoder.encode(canonical))
    );
    const toSign = Arr.join(["AWS4-HMAC-SHA256", amzDate, scope, hashed], "\n");
    const secret = encoder.encode(
      `AWS4${Redacted.value(request.secretAccessKey)}`
    );
    const dayKey = yield* hmac(secret, day);
    const regionKey = yield* hmac(dayKey, request.region);
    const serviceKey = yield* hmac(regionKey, "s3");
    const signingKey = yield* hmac(serviceKey, "aws4_request");
    const signature = Hex.encode(yield* hmac(signingKey, toSign));
    return `${request.url.origin}${canonicalPath(request.url)}?${query}&X-Amz-Signature=${signature}`;
  },
  Effect.provide(
    Layer.mergeAll(
      Digest.layerWebCrypto,
      Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
    )
  ),
  // Web Crypto serves every runtime Nakafa runs in, so a failed digest or MAC is a defect, as `sha256` treats it.
  Effect.orDie
);

/** What an object address binds beyond its method and key: its lifetime, its signed headers, and its query. */
const ObjectAddress = Schema.Struct({
  expiresSeconds: PresignRequest.fields.expiresSeconds,
  headers: Schema.optionalKey(PresignRequest.fields.headers),
  method: ObjectMethod,
  query: Schema.optionalKey(PresignRequest.fields.query),
});

/**
 * A presigned address of one object of the configured bucket, path style: `{endpoint}/{bucket}/{key}`. A bucket
 * that is not configured is a defect of the deployment, not a refusal of the caller.
 */
export const objectAddress = Effect.fn("bucket.objectAddress")(function* (
  key: string,
  address: typeof ObjectAddress.Type
) {
  const config = yield* bucketConfig.pipe(Effect.orDie);
  const url = new URL(config.endpoint);
  url.pathname = Arr.join(
    [
      Str.replace(TRAILING_SLASHES, "")(url.pathname),
      encodeStrict(config.bucket),
      ...Arr.map(Str.split(key, "/"), encodeStrict),
    ],
    "/"
  );
  url.search = "";
  return yield* presign({
    accessKeyId: config.accessKeyId,
    expiresSeconds: address.expiresSeconds,
    headers: address.headers ?? {},
    method: address.method,
    query: address.query ?? {},
    region: R2_REGION,
    secretAccessKey: config.secretAccessKey,
    signedAt: yield* Clock.currentTimeMillis,
    url,
  });
});
