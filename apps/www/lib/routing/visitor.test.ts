import { describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";
import { readVisitorUrl } from "@/lib/routing/visitor";

describe("visitor URL", () => {
  it("names the host and port of the Host header, with the protocol, path and query of the request", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3000/classes/fisika?tab=grades", {
        headers: { host: "harapan.localhost:3000" },
      })
    );

    expect(url.href).toBe(
      "http://harapan.localhost:3000/classes/fisika?tab=grades"
    );
  });

  it("names the IP address that the Host header names", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3000/en", {
        headers: { host: "127.0.0.1:3000" },
      })
    );

    expect(url.href).toBe("http://127.0.0.1:3000/en");
  });

  it("names the production school host with its https protocol and no port", () => {
    const url = readVisitorUrl(
      new NextRequest("https://harapan.nakafa.com/classes/", {
        headers: { host: "harapan.nakafa.com" },
      })
    );

    expect(url.href).toBe("https://harapan.nakafa.com/classes/");
  });

  it("keeps the host of the request URL when the request has no Host header", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3000/en/search")
    );

    expect(url.href).toBe("http://localhost:3000/en/search");
  });

  it("keeps the host of the request URL when the Host header names no host", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3000/en/search", {
        headers: { host: "harapan.localhost/en" },
      })
    );

    expect(url.href).toBe("http://localhost:3000/en/search");
  });

  it("names the default port of the protocol when the Host header names no port, although the server listens on another", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3400/classes/", {
        headers: { host: "harapan.localhost" },
      })
    );

    expect(url.href).toBe("http://harapan.localhost/classes/");
  });

  it("names the port of the Host header, although the server listens on another", () => {
    const url = readVisitorUrl(
      new NextRequest("http://localhost:3000/classes/", {
        headers: { host: "harapan.localhost:8080" },
      })
    );

    expect(url.href).toBe("http://harapan.localhost:8080/classes/");
  });
});
