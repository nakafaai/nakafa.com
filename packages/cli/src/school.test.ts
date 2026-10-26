import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  MutableHashMap,
  Option,
  Path,
  PlatformError,
  Record as Rec,
  Ref,
} from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
  UrlParams,
} from "effect/http";
import { TestClock } from "effect/testing";
import { storeSession } from "#cli/credentials";
import { loginSchool, logoutSchool, readSchool } from "#cli/school";

/** A file system that keeps one stored sign-in in memory. */
const memoryLayer = () => {
  const files = MutableHashMap.empty<string, string>();
  return FileSystem.layerNoop({
    chmod: () => Effect.void,
    makeDirectory: () => Effect.void,
    readFileString: (path) =>
      Effect.fromOption(MutableHashMap.get(files, path)).pipe(
        Effect.mapError(() =>
          PlatformError.systemError({
            _tag: "NotFound",
            method: "readFileString",
            module: "FileSystem",
            pathOrDescriptor: path,
          })
        )
      ),
    remove: (path) =>
      Effect.sync(() => {
        MutableHashMap.remove(files, path);
      }),
    writeFileString: (path, data) =>
      Effect.sync(() => {
        MutableHashMap.set(files, path, data);
      }),
  });
};

/** An OAuth refusal as the token endpoint encodes it. */
const oauth = (error: string, description = "Wait.") =>
  Response.json(
    { _tag: "OAuthError", error, error_description: description },
    { status: 400 }
  );

/** A client that answers each request with the next response of its path, and records the requests. */
const scripted = (
  requests: Ref.Ref<readonly HttpClientRequest.HttpClientRequest[]>,
  answers: Record<string, readonly Response[]>
) => {
  const queues = Ref.makeUnsafe(answers);
  return HttpClient.make((request) => {
    const path = new URL(request.url).pathname;
    return Ref.update(requests, Arr.append(request)).pipe(
      Effect.andThen(
        Ref.modify(queues, (all) => {
          const queue = Option.getOrElse(Rec.get(all, path), Arr.empty);
          return [Arr.head(queue), Rec.set(all, path, Arr.drop(queue, 1))];
        })
      ),
      Effect.map((next) =>
        HttpClientResponse.fromWeb(
          request,
          Option.getOrElse(next, () => Response.json({}, { status: 500 }))
        )
      )
    );
  });
};

/** The services of one CLI run: the scripted client, an in-memory sign-in file, and a home directory. */
const services = (client: HttpClient.HttpClient) =>
  Layer.mergeAll(
    memoryLayer(),
    Path.layer,
    ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: "/home/sari" })),
    Layer.succeed(HttpClient.HttpClient, client)
  );

describe("CLI school commands", () => {
  it.effect(
    "signs in with the device grant, waiting out pending and slow polls, then reads as the connected client",
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          readonly HttpClientRequest.HttpClientRequest[]
        >([]);
        const client = scripted(requests, {
          "/api/v1/device": [
            Response.json({
              device_code: "device",
              expires_in: 600,
              interval: 5,
              user_code: "BCDF-GHJK",
              verification_uri: "https://harapan.nakafa.com/settings/clients",
            }),
          ],
          "/api/v1/periods": [Response.json({ data: [], next: null })],
          "/api/v1/token": [
            oauth("authorization_pending"),
            oauth("slow_down"),
            Response.json({
              access_token: "token",
              expires_in: 3600,
              token_type: "Bearer",
            }),
          ],
        });
        yield* Effect.gen(function* () {
          const login = yield* Effect.forkChild(
            loginSchool("harapan.nakafa.com")
          );
          yield* TestClock.adjust("5 seconds");
          yield* TestClock.adjust("5 seconds");
          yield* TestClock.adjust("10 seconds");
          expect(yield* Fiber.join(login)).toEqual({
            expires_at: 3_620_000,
            school: "harapan.nakafa.com",
          });
          expect(yield* readSchool({ read: "periods" })).toEqual({
            data: [],
            next: null,
          });
        }).pipe(Effect.provide(services(client)));
        const sent = yield* Ref.get(requests);
        expect(
          Arr.map(sent, (request) => new URL(request.url).pathname)
        ).toEqual([
          "/api/v1/device",
          "/api/v1/token",
          "/api/v1/token",
          "/api/v1/token",
          "/api/v1/periods",
        ]);
        expect(sent[4]?.headers.authorization).toBe("Bearer token");
      })
  );

  it.effect(
    "reports a turned-away device, an unknown school, and a read before signing in",
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          readonly HttpClientRequest.HttpClientRequest[]
        >([]);
        const denied = scripted(requests, {
          "/api/v1/device": [
            Response.json({
              device_code: "device",
              expires_in: 600,
              interval: 5,
              user_code: "BCDF-GHJK",
              verification_uri: "https://harapan.nakafa.com/settings/clients",
            }),
            oauth("invalid_request", "No active school has this address."),
          ],
          "/api/v1/token": [
            oauth("access_denied", "The school's Admin denied this device."),
          ],
        });
        yield* Effect.gen(function* () {
          const login = yield* Effect.forkChild(
            Effect.flip(loginSchool("harapan.nakafa.com"))
          );
          yield* TestClock.adjust("5 seconds");
          expect(yield* Fiber.join(login)).toMatchObject({
            code: "access_denied",
            message: "The school's Admin denied this device.",
          });
          expect(
            yield* Effect.flip(loginSchool("nope.nakafa.com"))
          ).toMatchObject({
            code: "invalid_request",
            message: "No active school has this address.",
          });
          expect(
            yield* Effect.flip(readSchool({ read: "periods" }))
          ).toMatchObject({
            code: "NOT_SIGNED_IN",
          });
          expect(yield* logoutSchool()).toEqual({ signed_out: true });
        }).pipe(Effect.provide(services(denied)));
      })
  );

  it.effect(
    "reads the class groups, people, and placements a page at a time, and reports a closed read",
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          readonly HttpClientRequest.HttpClientRequest[]
        >([]);
        const page = () => Response.json({ data: [], next: null });
        const client = scripted(requests, {
          "/api/v1/cohorts": [
            page(),
            Response.json(
              {
                _tag: "SchoolApiForbidden",
                message: "This client may not read it.",
              },
              { status: 403 }
            ),
          ],
          "/api/v1/people": [page(), page()],
          "/api/v1/placements": [page()],
        });
        yield* Effect.gen(function* () {
          yield* storeSession({
            expiresAt: 1000,
            host: "harapan.nakafa.com",
            token: "token",
          });
          yield* readSchool({ cursor: "next", period: "p1", read: "cohorts" });
          yield* readSchool({ read: "people", status: "suspended" });
          yield* readSchool({ read: "people" });
          yield* readSchool({ period: "p1", read: "placements" });
          expect(
            yield* Effect.flip(readSchool({ period: "p1", read: "cohorts" }))
          ).toMatchObject({ message: "This client may not read it." });
        }).pipe(Effect.provide(services(client)));
        expect(
          Arr.map(yield* Ref.get(requests), (request) => {
            const query = UrlParams.toString(request.urlParams);
            return `${new URL(request.url).pathname}${query === "" ? "" : `?${query}`}`;
          })
        ).toEqual([
          "/api/v1/cohorts?cursor=next&period=p1",
          "/api/v1/people?status=suspended",
          "/api/v1/people",
          "/api/v1/placements?period=p1",
          "/api/v1/cohorts?period=p1",
        ]);
      })
  );
});
