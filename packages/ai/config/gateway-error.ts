import { GatewayError } from "@ai-sdk/gateway";

/**
 * Extracts Gateway failure metadata that helps correlate Nakafa logs with
 * Vercel AI Gateway generation records.
 *
 * @see https://vercel.com/docs/ai-gateway/observability
 */
export function getGatewayErrorContext(error: unknown) {
  if (!GatewayError.isInstance(error)) {
    return {};
  }

  return {
    gatewayErrorType: error.type,
    gatewayGenerationId: error.generationId,
    gatewayRetryable: error.isRetryable,
    gatewayStatusCode: error.statusCode,
  };
}
