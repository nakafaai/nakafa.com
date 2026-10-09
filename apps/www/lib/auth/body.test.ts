import { describe, expect, it } from "@effect/vitest";
import { bufferResponse } from "@/lib/auth/body";

describe("bufferResponse", () => {
  it("returns the same status, status text, headers, and bytes", async () => {
    const upstream = new Response(new Uint8Array([0, 255, 128]), {
      status: 201,
      statusText: "Created",
      headers: [
        ["content-type", "application/octet-stream"],
        ["set-cookie", "session=a; Path=/"],
        ["set-cookie", "device=b; Path=/"],
      ],
    });

    const buffered = await bufferResponse(upstream);

    expect(buffered.status).toBe(201);
    expect(buffered.statusText).toBe("Created");
    expect(buffered.headers.get("content-type")).toBe(
      "application/octet-stream"
    );
    expect(buffered.headers.getSetCookie()).toStrictEqual([
      "session=a; Path=/",
      "device=b; Path=/",
    ]);
    expect(new Uint8Array(await buffered.arrayBuffer())).toStrictEqual(
      new Uint8Array([0, 255, 128])
    );
  });

  it("returns a response without a body as the same object", async () => {
    const noContent = new Response(null, { status: 204 });
    const redirect = Response.redirect("https://nakafa.com/id", 302);

    expect(await bufferResponse(noContent)).toBe(noContent);
    expect(await bufferResponse(redirect)).toBe(redirect);
  });

  it("rejects when the body read fails", async () => {
    const failure = new Error("connection lost while reading");
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(failure);
        },
      })
    );

    await expect(bufferResponse(response)).rejects.toBe(failure);
  });
});
