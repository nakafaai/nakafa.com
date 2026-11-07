import { ObjectMethod, presign } from "@repo/backend/confect/bucket/sign";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  FileSystem,
  Option,
  Record as Rec,
  Redacted,
  Schema,
  String as Str,
} from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

/** The path under the stand-in origin where the bucket stand-in answers, as `R2_ENDPOINT` names it. */
export const BUCKET_PATH = "/r2";

/** The inert credentials and bucket of the local stand-in, which only guard loopback. */
export const localBucketEnvironment = {
  R2_ACCESS_KEY_ID: "acceptance-r2",
  R2_BUCKET: "nakafa-files",
  R2_SECRET_ACCESS_KEY: "acceptance-r2-secret",
};

/** The headers that let the app's origin upload to the stand-in and read its answers. */
const CROSS_ORIGIN_HEADERS = {
  "access-control-allow-headers": "content-type, range",
  "access-control-allow-methods": "GET, HEAD, PUT, DELETE, OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "content-length, content-type",
};

/** An answer of the stand-in with the cross-origin headers. */
const answer = (status: number, headers: Record<string, string> = {}) =>
  HttpServerResponse.empty({
    headers: { ...CROSS_ORIGIN_HEADERS, ...headers },
    status,
  });

/** The time an X-Amz-Date such as `20261107T104500Z` names, when it names one. */
const signedAtOf = (stamp: string) =>
  Option.map(
    DateTime.make(
      `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`
    ),
    DateTime.toEpochMillis
  );

/**
 * Whether a request carries a presigned address that the stand-in's own credentials sign the same way, still within
 * its lifetime, with every header it binds sent unchanged. R2 checks the same three things.
 */
const isSigned = Effect.fn("contentAcceptance.bucket.isSigned")(function* (
  request: HttpServerRequest.HttpServerRequest,
  url: URL
) {
  const query = Rec.fromEntries(url.searchParams.entries());
  const expires = Number(query["X-Amz-Expires"] ?? "0");
  const names = Str.split(query["X-Amz-SignedHeaders"] ?? "", ";");
  const signedAt = signedAtOf(query["X-Amz-Date"] ?? "");
  const method = Schema.decodeUnknownOption(ObjectMethod)(request.method);
  const now = yield* Clock.currentTimeMillis;
  if (
    Option.isNone(signedAt) ||
    Option.isNone(method) ||
    now > signedAt.value + expires * 1000
  ) {
    return false;
  }
  const headers = Rec.fromEntries(
    Arr.map(
      Arr.filter(names, (name) => name !== "host"),
      (name) => [name, request.headers[name] ?? ""] as const
    )
  );
  const extra = Rec.filter(query, (_, name) => !Str.startsWith("X-Amz-")(name));
  const target = new URL(url.pathname, url.origin);
  const expected = yield* presign({
    accessKeyId: localBucketEnvironment.R2_ACCESS_KEY_ID,
    expiresSeconds: expires,
    headers,
    method: method.value,
    query: extra,
    region: "auto",
    secretAccessKey: Redacted.make(localBucketEnvironment.R2_SECRET_ACCESS_KEY),
    signedAt: signedAt.value,
    url: target,
  });
  return (
    new URL(expected).searchParams.get("X-Amz-Signature") ===
    query["X-Amz-Signature"]
  );
});

/** A range header of one span, as the server asks for an object's leading bytes. */
const RANGE = /^bytes=(?<start>\d+)-(?<end>\d+)$/u;

/** Stores an upload with the type it was sent as. Its signature already bound its length, as R2's does. */
const store = Effect.fn("contentAcceptance.bucket.store")(function* (
  request: HttpServerRequest.HttpServerRequest,
  file: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFile(file, new Uint8Array(yield* request.arrayBuffer));
  yield* fs.writeFileString(
    `${file}.type`,
    request.headers["content-type"] ?? "application/octet-stream"
  );
  return answer(200);
});

/** Answers a stored object's size, or its bytes, whole or the range asked for, with the type and name its address asks for. */
const serve = Effect.fn("contentAcceptance.bucket.serve")(function* (
  request: HttpServerRequest.HttpServerRequest,
  url: URL,
  file: string
) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(file))) {
    return answer(404);
  }
  const bytes = yield* fs.readFile(file);
  const disposition = url.searchParams.get("response-content-disposition");
  const headers = {
    "content-type":
      url.searchParams.get("response-content-type") ??
      (yield* fs.readFileString(`${file}.type`)),
    ...(disposition === null ? {} : { "content-disposition": disposition }),
  };
  if (request.method === "HEAD") {
    return answer(200, {
      ...headers,
      "content-length": String(bytes.byteLength),
    });
  }
  const range = RANGE.exec(request.headers.range ?? "");
  return HttpServerResponse.uint8Array(
    range === null
      ? bytes
      : bytes.slice(Number(range.groups?.start), Number(range.groups?.end) + 1),
    {
      headers: { ...CROSS_ORIGIN_HEADERS, ...headers },
      status: range === null ? 200 : 206,
    }
  );
});

/**
 * Stands in for R2's S3 API while acceptance serves the app: it keeps each object as a file in the runtime
 * directory, so the browser uploads to it, Convex actions read its size and leading bytes, and an opened file
 * downloads from it, exactly as against the bucket. A request whose address is unsigned or expired is refused.
 */
export const bucketStandIn = (directory: string) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.method === "OPTIONS") {
      return answer(204);
    }
    // The signature binds the host with its port, which only the Host header carries here.
    const url = new URL(request.url, `http://${request.headers.host}`);
    const fs = yield* FileSystem.FileSystem;
    const root = `${directory}/bucket`;
    yield* fs.makeDirectory(root, { recursive: true });
    if (!(yield* isSigned(request, url))) {
      return answer(403);
    }
    const file = `${root}/${encodeURIComponent(url.pathname)}`;
    if (request.method === "PUT") {
      return yield* store(request, file);
    }
    if (request.method === "DELETE") {
      yield* fs.remove(file, { force: true });
      yield* fs.remove(`${file}.type`, { force: true });
      return answer(204);
    }
    return yield* serve(request, url, file);
  }).pipe(Effect.orDie);
