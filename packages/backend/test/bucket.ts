import { Record as Rec } from "effect";

/** The endpoint the tests configure for R2, which no request ever leaves the process for. */
const BUCKET_ENDPOINT = "https://account.r2.test";

/** The bucket the tests configure. */
const BUCKET = "files";

/** Configures the bucket as a deployment does, with inert credentials. */
export const stubBucket = () => {
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_BUCKET", BUCKET);
  vi.stubEnv("R2_ENDPOINT", BUCKET_ENDPOINT);
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
};

/** A range header of one span, as the server asks for leading bytes. */
const RANGE = /^bytes=(?<start>\d+)-(?<end>\d+)$/u;

/** Whether a request goes to the test bucket. */
export const isBucketRequest = (input: RequestInfo | URL) =>
  new Request(input).url.startsWith(BUCKET_ENDPOINT);

/**
 * An in-memory R2 that answers the S3 requests the server sends and the uploads a test makes: PUT stores the body,
 * HEAD answers the size, GET answers the bytes or the range asked for, and DELETE removes. `objects` holds what it
 * stores by object key, and `failing` makes every answer a 500.
 */
export const makeBucket = () => {
  const objects: Record<string, Uint8Array> = {};
  const state = { failing: false, objects };
  const keyOf = (url: string) =>
    decodeURIComponent(new URL(url).pathname.slice(`/${BUCKET}/`.length));
  const answer = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (state.failing) {
      return new Response(null, { status: 500 });
    }
    const key = keyOf(request.url);
    const stored = state.objects[key];
    if (request.method === "PUT") {
      state.objects[key] = new Uint8Array(await request.arrayBuffer());
      return new Response(null, { status: 200 });
    }
    if (request.method === "DELETE") {
      state.objects = Rec.remove(state.objects, key);
      return new Response(null, { status: 204 });
    }
    if (stored === undefined) {
      return new Response(null, { status: 404 });
    }
    if (request.method === "HEAD") {
      return new Response(null, {
        headers: { "content-length": String(stored.byteLength) },
      });
    }
    const range = RANGE.exec(request.headers.get("range") ?? "");
    return new Response(
      range === null
        ? stored
        : stored.slice(
            Number(range.groups?.start),
            Number(range.groups?.end) + 1
          ),
      { status: range === null ? 200 : 206 }
    );
  };
  return { answer, keyOf, state };
};

/** Uploads bytes to a presigned address as a browser does. */
export const upload = (
  bucket: ReturnType<typeof makeBucket>,
  address: string,
  bytes: Uint8Array
) => {
  bucket.state.objects[bucket.keyOf(address)] = bytes;
};
