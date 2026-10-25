// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import {
  answerRouteMessages,
  RouteMessagesInput,
} from "@/lib/i18n/messages.functions";

const routeMessagesHandler = vi.hoisted(() => vi.fn());

vi.mock("@/lib/i18n/messages.server", () => ({ routeMessagesHandler }));

describe("route messages", () => {
  it("hands the route's locale and namespaces to the server module", async () => {
    routeMessagesHandler.mockReturnValueOnce({ Common: {} });
    const data = { locale: "en", namespaces: ["Common"] } as const;
    expect(await answerRouteMessages({ data })).toStrictEqual({ Common: {} });
    expect(routeMessagesHandler).toHaveBeenCalledWith({ data });
  });

  it("refuses a locale and a namespace that the contracts do not name", () => {
    const decode = Schema.decodeUnknownOption(RouteMessagesInput);
    expect(
      Option.isNone(decode({ locale: "fr", namespaces: ["Common"] }))
    ).toBe(true);
    expect(
      Option.isNone(decode({ locale: "en", namespaces: ["Unknown"] }))
    ).toBe(true);
    expect(
      Option.isSome(decode({ locale: "en", namespaces: ["Common"] }))
    ).toBe(true);
  });
});
