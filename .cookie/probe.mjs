// Throwaway: which cookies Linux WebKit keeps on loopback hosts.
import { createServer } from "node:http";
import { chromium, firefox, webkit } from "playwright";

const server = createServer((req, res) => {
  if (req.url === "/set") {
    res.setHeader("Set-Cookie", [
      "hostonly=1; Path=/; SameSite=Lax",
      "domainattr=1; Domain=localhost; Path=/; SameSite=Lax",
      "httponly=1; Path=/; HttpOnly; SameSite=Lax",
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
    const context = await browser.newContext();
    await context.addCookies([{ name: "added", value: "1", url: origin, sameSite: "Lax", httpOnly: true }]);
    await context.request.get(`${origin}/set`);
    const page = await context.newPage();
    await page.goto(`${origin}/read`);
    const sent = await page.textContent("p");
    const doc = await page.evaluate(() => document.cookie);
    const jar = (await context.cookies(origin)).map((c) => `${c.name}@${c.domain}`).join(",");
    await page.goto(`${origin}/set`);
    await page.goto(`${origin}/read`);
    const sent2 = await page.textContent("p");
    console.log(`${type.name()} ${host} | after addCookies+request: sent=[${sent}] doc=[${doc}] jar=[${jar}] | after page Set-Cookie: sent=[${sent2}]`);
    await context.close();
  }
  await browser.close();
}
server.close();
