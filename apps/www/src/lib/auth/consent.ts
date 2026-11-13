import { Schema } from "effect";

/** Text that reads as an absolute address, such as an agent's redirect address. */
const AbsoluteAddress = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((text: string) => URL.canParse(text), {
      message: "Expected an absolute address.",
    })
  )
);

/**
 * An agent's authorization request, as the consent page reads it from its
 * address: the authorization code with PKCE (RFC 6749 section 4.1.1, RFC 7636
 * section 4.3). The only challenge method is S256, so a request that names
 * another reads as no request at all.
 */
export const AgentRequest = Schema.Struct({
  client_id: Schema.NonEmptyString,
  code_challenge: Schema.NonEmptyString,
  code_challenge_method: Schema.Literal("S256"),
  redirect_uri: AbsoluteAddress,
  response_type: Schema.Literal("code"),
  state: Schema.optionalKey(Schema.String),
});

/** The request that the consent page's address carries, or none when it is malformed. */
export const readAgentRequest = Schema.decodeUnknownOption(AgentRequest);

/** What the person answered: a code for the agent to trade, or no. */
export const AgentAnswer = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Allowed"), code: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("Denied") }),
]);

/**
 * The address that sends the browser back to the agent with the person's answer
 * (RFC 6749 section 4.1.2): the code, or the `access_denied` error, and the
 * request's `state` unchanged, on the query of the agent's own redirect address.
 */
export function agentAnswerAddress(
  request: typeof AgentRequest.Type,
  answer: typeof AgentAnswer.Type
) {
  const address = new URL(request.redirect_uri);
  if (answer._tag === "Allowed") {
    address.searchParams.set("code", answer.code);
  } else {
    address.searchParams.set("error", "access_denied");
  }
  if (request.state !== undefined) {
    address.searchParams.set("state", request.state);
  }
  return address.href;
}
