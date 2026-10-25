/**
 * Reads a whole response body and returns a response that holds the bytes, with
 * the same status, status text, and headers. A caller that sets a deadline on a
 * request must call this inside the deadline: `fetch` resolves with the headers,
 * and the body is read afterwards, so a body that never ends would outlive it.
 *
 * A response whose body is null has nothing to read and is returned as it is.
 */
export async function bufferResponse(response: Response): Promise<Response> {
  if (response.body === null) {
    return response;
  }
  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
