import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readStaticData } from "@/lib/static/data";

const recordStaticCall = vi.hoisted(() => vi.fn());
const readStaticAnswer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/static/record.server", () => ({ recordStaticCall }));
vi.mock("@/lib/static/answer", () => ({ readStaticAnswer }));

beforeEach(() => {
  recordStaticCall.mockReset().mockReturnValue(Effect.void);
  readStaticAnswer.mockReset().mockReturnValue(Effect.succeedNone);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A stand-in server function: it names its address and echoes how it was called. */
const echo = Object.assign(
  vi.fn(
    <Input extends { readonly locale: string }>(options: {
      readonly data: Input;
      readonly fetch?: () => Promise<Response>;
    }) =>
      Promise.resolve({
        fromFile: options.fetch !== undefined,
        locale: options.data.locale,
      })
  ),
  { url: "/_serverFn/echo" }
);

describe("lib/static/data", () => {
  it("runs the function on the server and records the call", async () => {
    vi.stubEnv("SSR", true);

    expect(await readStaticData(echo, { locale: "id" })).toEqual({
      fromFile: false,
      locale: "id",
    });
    expect(recordStaticCall).toHaveBeenCalledWith("/_serverFn/echo", {
      locale: "id",
    });
  });

  it("hands a static answer in the browser to the function's own decoder", async () => {
    vi.stubEnv("SSR", false);
    const response = new Response("{}");
    readStaticAnswer.mockReturnValue(Effect.succeedSome(response));

    expect(await readStaticData(echo, { locale: "en" })).toEqual({
      fromFile: true,
      locale: "en",
    });
    const options = echo.mock.lastCall?.[0];
    expect(await options?.fetch?.()).toBe(response);
  });

  it("asks the Worker in the browser when the build kept no answer", async () => {
    vi.stubEnv("SSR", false);

    expect(await readStaticData(echo, { locale: "de" })).toEqual({
      fromFile: false,
      locale: "de",
    });
    expect(recordStaticCall).not.toHaveBeenCalled();
  });
});
