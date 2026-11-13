// Measurement only: serves every build of the config over HTTP/2 with Brotli, then runs Lighthouse on one page,
// alternating the builds run by run on this one machine. Usage: node .perf/measure.mjs <page index>
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync(".perf/config.json", "utf8"));
const page = config.pages[Number(process.argv[2])];
mkdirSync("reports", { recursive: true });
const servers = config.builds.map((build, index) => {
  const port = 4400 + index;
  const child = spawn("node", [".perf/serve.mjs", `builds/${build.label}/client`, String(port), "."], { stdio: "inherit" });
  return { ...build, port, child };
});
execFileSync("sleep", ["2"]);
// The slowdown that matches ADR 0039 D1 (12x on a machine of benchmark index 3,500), from this VM's own index.
function lighthouseArgs(url, slowdown, out) {
  return [
    url,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--form-factor=mobile",
    "--screenEmulation.mobile=true",
    "--screenEmulation.width=390",
    "--screenEmulation.height=844",
    "--screenEmulation.deviceScaleFactor=3",
    `--throttling.cpuSlowdownMultiplier=${slowdown}`,
    "--chrome-flags=--headless=new --no-first-run --ignore-certificate-errors --no-sandbox",
    "--output=json",
    `--output-path=${out}`,
    "--quiet",
  ];
}
execFileSync("lighthouse", lighthouseArgs(`https://localhost:${servers[0].port}${page}`, 1, "reports/calibration.json"), { stdio: "inherit" });
const bench = JSON.parse(readFileSync("reports/calibration.json", "utf8")).environment.benchmarkIndex;
const slowdown = config.slowdown === "scaled" ? Math.max(4, Math.round((12 * bench) / 3500)) : config.slowdown;
console.log(`benchmark index ${Math.round(bench)}, slowdown ${slowdown}`);
const slug = page.replace(/[^a-z0-9]+/giu, "_").replace(/^_|_$/gu, "") || "root";
const rows = [];
for (let run = 1; run <= config.runs; run += 1) {
  for (const server of run % 2 ? servers : [...servers].reverse()) {
    const out = `reports/${slug}.${server.label}.${run}.json`;
    try {
      execFileSync("lighthouse", lighthouseArgs(`https://localhost:${server.port}${page}`, slowdown, out), { stdio: "inherit" });
      const r = JSON.parse(readFileSync(out, "utf8"));
      const a = r.audits;
      const scripts = (a["resource-summary"]?.details?.items ?? []).find((i) => i.resourceType === "script") ?? {};
      rows.push({
        build: server.label,
        run,
        bench: Math.round(r.environment.benchmarkIndex),
        perf: Math.round(r.categories.performance.score * 100),
        a11y: Math.round(r.categories.accessibility.score * 100),
        bp: Math.round(r.categories["best-practices"].score * 100),
        seo: Math.round(r.categories.seo.score * 100),
        fcp: Math.round(a["first-contentful-paint"].numericValue),
        lcp: Math.round(a["largest-contentful-paint"].numericValue),
        tbt: Math.round(a["total-blocking-time"].numericValue),
        cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
        si: Math.round(a["speed-index"].numericValue),
        jsKb: Math.round((scripts.transferSize ?? 0) / 1024),
        jsReq: scripts.requestCount ?? 0,
        bootMs: Math.round(a["bootup-time"].numericValue),
        mainMs: Math.round(a["mainthread-work-breakdown"].numericValue),
        dom: a["dom-size"]?.numericValue ?? 0,
      });
    } catch (error) {
      rows.push({ build: server.label, run, error: String(error).slice(0, 200) });
    }
  }
}
writeFileSync(`reports/${slug}.summary.json`, JSON.stringify({ page, slowdown, bench: Math.round(bench), rows }, null, 2));
console.table(rows);
for (const server of servers) server.child.kill();
