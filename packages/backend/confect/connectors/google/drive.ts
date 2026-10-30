import { GoogleFailed } from "@repo/backend/confect/connectors/errors";
import { GOOGLE_DEADLINE } from "@repo/backend/confect/connectors/google/oauth";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/** The files endpoint of Google Drive. */
const FILES_ROOT = "https://www.googleapis.com/drive/v3/files/";

/** What a picked file is, as Drive answers its metadata. A Google document has no size: it is no stored file. */
const FileAnswer = Schema.fromJsonString(
  Schema.Struct({
    mimeType: Schema.String,
    name: Schema.String,
    size: Schema.optionalKey(Schema.FiniteFromString),
  })
);

/** The address of one file, with its query. */
const fileUrl = (fileId: string, query: Record<string, string>) => {
  const url = new URL(encodeURIComponent(fileId), FILES_ROOT);
  url.search = new URLSearchParams(query).toString();
  return url;
};

/**
 * Reads one Drive file with the connection's access token, which covers
 * `drive.file`: only the files the user picked with Nakafa. Google refusing the
 * token fails as `revoked`, a file it does not give as `refused`.
 */
const readDrive = Effect.fn("connectors.google.drive.read")(function* (
  accessToken: string,
  url: URL
) {
  const response = yield* (yield* HttpClient.HttpClient)
    .execute(
      HttpClientRequest.get(url).pipe(
        HttpClientRequest.bearerToken(accessToken)
      )
    )
    .pipe(
      Effect.timeout(GOOGLE_DEADLINE),
      Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
    );
  if (response.status === 401) {
    return yield* new GoogleFailed({ reason: "revoked", status: 401 });
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new GoogleFailed({
      reason: "refused",
      status: response.status,
    });
  }
  return response;
});

/** The name, type, and size of one picked file. */
export const driveFile = (accessToken: string, fileId: string) =>
  readDrive(
    accessToken,
    fileUrl(fileId, { fields: "mimeType,name,size" })
  ).pipe(
    Effect.flatMap((response) =>
      response.text.pipe(
        Effect.flatMap(Schema.decodeEffect(FileAnswer)),
        Effect.mapError(() => new GoogleFailed({ reason: "invalid" }))
      )
    ),
    Effect.scoped
  );

/** The bytes of one picked file. */
export const driveBytes = (accessToken: string, fileId: string) =>
  readDrive(accessToken, fileUrl(fileId, { alt: "media" })).pipe(
    Effect.flatMap((response) =>
      response.arrayBuffer.pipe(
        Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
      )
    ),
    Effect.scoped
  );
