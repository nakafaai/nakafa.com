// Throwaway: what Linux WebKit keeps and sends on loopback hosts, in the suite's sign-in flow.
import { createServer } from "node:http";
import { chromium, firefox, webkit } from "playwright";

const seen = [];
const server = createServer((req, res) => {
  seen.push(`${req.url} <- ${req.headers.cookie ?? "none"}`);
  if (req.url === "/session") {
    res.setHeader("Set-Cookie", [
      "hint=1; Path=/; SameSite=Lax; Max-Age=604800",
      "hintdomain=1; Domain=localhost; Path=/; SameSite=Lax; Max-Age=604800",
      "refreshed=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
      "secureone=1; Path=/; Secure; SameSite=Lax",
    ]);
  }
  res.setHeader("Content-Type", "text/html");
  res.end(`<p>${req.headers.cookie ?? "none"}</p>`);
});
await new Promise((ok) => server.listen(3000, ok));

for (const type of [webkit, chromium, firefox]) {
  const browser = await type.launch();
  for (const host of ["localhost", "127.0.0.1", "app.localhost"]) {
    const origin = `http://${host}:3000`;
    seen.length = 0;
    const context = await browser.newContext();
    await context.addCookies([
      { name: "session", value: "abc.def%2Fghi", url: origin, sameSite: "Lax", httpOnly: true },
      { name: "plain", value: "1", url: origin },
    ]);
    const jar0 = (await context.cookies(origin)).map((c) => `${c.name}@${c.domain}${c.secure ? "+s" : ""}`).join(",");
    await context.request.get(`${origin}/session`);
    const jar1 = (await context.cookies(origin)).map((c) => `${c.name}@${c.domain}${c.secure ? "+s" : ""}`).join(",");
    const page = await context.newPage();
    await page.goto(`${origin}/page`);
    const doc = await page.evaluate(() => document.cookie);
    const fetched = await page.evaluate(() => fetch("/fetch").then((r) => r.text()));
    console.log(`${type.name()} ${host}\n  jar after addCookies: ${jar0}\n  jar after request: ${jar1}\n  server saw: ${seen.join(" | ")}\n  document.cookie: ${doc}\n  fetch: ${fetched}`);
    await context.close();
  }
  await browser.close();
}
server.close();
