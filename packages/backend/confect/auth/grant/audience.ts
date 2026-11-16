/**
 * The audience of an agent's token, which tells it apart from every other token
 * the app signs. The auth configuration and the token's signing both read it,
 * and it imports nothing, so loading the configuration loads nothing else.
 */
export const AGENT_TOKEN_AUDIENCE = "nakafa-agent";
