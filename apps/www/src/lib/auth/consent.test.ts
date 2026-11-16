// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Record } from "effect";
import {
  agentAnswerAddress,
  agentHost,
  readAgentRequest,
} from "@/lib/auth/consent";

/** An agent's request as an MCP client sends it to the consent page. */
const REQUEST = {
  client_id: "k57abc",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  redirect_uri: "http://127.0.0.1:33418/callback?session=1",
  response_type: "code",
  scope: "mcp",
  state: "af0ifjsldkj",
};

describe("readAgentRequest", () => {
  it("reads an authorization code request with an S256 challenge", () => {
    expect(readAgentRequest(REQUEST)).toEqual(
      Option.some({
        client_id: REQUEST.client_id,
        code_challenge: REQUEST.code_challenge,
        code_challenge_method: "S256",
        redirect_uri: REQUEST.redirect_uri,
        response_type: "code",
        state: REQUEST.state,
      })
    );
  });

  it("refuses a request it must not answer", () => {
    expect(
      readAgentRequest({ ...REQUEST, code_challenge_method: "plain" })
    ).toEqual(Option.none());
    expect(readAgentRequest({ ...REQUEST, response_type: "token" })).toEqual(
      Option.none()
    );
    expect(readAgentRequest({ ...REQUEST, redirect_uri: "/callback" })).toEqual(
      Option.none()
    );
    expect(readAgentRequest({ ...REQUEST, client_id: "" })).toEqual(
      Option.none()
    );
  });
});

describe("agentAnswerAddress", () => {
  const request = Option.getOrThrow(readAgentRequest(REQUEST));

  it("names the host that the answer goes to", () => {
    expect(agentHost(request)).toBe("127.0.0.1:33418");
  });

  it("returns the code and the state on the agent's own address", () => {
    const address = new URL(
      agentAnswerAddress(request, { _tag: "Allowed", code: "c0de" })
    );
    expect(address.origin + address.pathname).toBe(
      "http://127.0.0.1:33418/callback"
    );
    expect(Record.fromEntries(Arr.fromIterable(address.searchParams))).toEqual({
      code: "c0de",
      session: "1",
      state: REQUEST.state,
    });
  });

  it("returns access_denied when the person says no, without a state the agent never sent", () => {
    const { state: _, ...stateless } = request;
    const address = new URL(agentAnswerAddress(stateless, { _tag: "Denied" }));
    expect(Record.fromEntries(Arr.fromIterable(address.searchParams))).toEqual({
      error: "access_denied",
      session: "1",
    });
  });
});
