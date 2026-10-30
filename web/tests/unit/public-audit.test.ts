import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/audit-public.mjs", import.meta.url),
);

async function fixture(
  paths: string[],
  options: { fail?: boolean; redirect?: boolean } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), "runscars-audit-test-"));
  const requests: Array<{ url: string; userAgent: string | undefined }> = [];
  let reportNumber = 0;
  let origin = "";
  const server = createServer((request, response) => {
    const url = request.url!;
    requests.push({ url, userAgent: request.headers["user-agent"] });
    if (url === "/sitemap.xml") {
      response.setHeader("Content-Type", "application/xml");
      response.end(
        `<urlset>${paths.map((route) => `<url><loc>${origin}${route}</loc></url>`).join("")}</urlset>`,
      );
      return;
    }
    if (options.redirect && !url.startsWith("/redirected")) {
      response.writeHead(302, { Location: `/redirected${url}` });
      response.end();
      return;
    }
    if (options.fail) {
      response.writeHead(503);
      response.end("Temporary failure");
      return;
    }
    const spanish = url.replace(/^\/en(?:\/|$)/, "/");
    const english = `/en${spanish === "/" ? "" : spanish}`;
    response.setHeader("Content-Type", "text/html");
    response.end(`<!doctype html><title>Fixture</title>
      <link rel="canonical" href="${origin}${url}">
      <link rel="alternate" hreflang="es" href="${origin}${spanish}">
      <link rel="alternate" hreflang="en" href="${origin}${english}">
      <link rel="alternate" hreflang="x-default" href="${origin}${spanish}">
      <script type="application/ld+json">{"@type":"WebPage"}</script>
      <a href="/personas/discovered?edition=1">Extra page</a>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    requests,
    async run(args: string[] = [], extra: Record<string, string> = {}) {
      const reportPath = path.join(directory, `report-${reportNumber++}.json`);
      const result = await new Promise<{ code: number; stderr: string }>(
        (resolve) => {
          execFile(
            process.execPath,
            [script, ...args],
            {
              env: {
                ...process.env,
                RUNSCARS_AUDIT_BASE_URL: origin,
                RUNSCARS_CANONICAL_ORIGIN: origin,
                RUNSCARS_AUDIT_REPORT: reportPath,
                RUNSCARS_AUDIT_FULL: "false",
                RUNSCARS_AUDIT_MAX_REQUESTS: "",
                RUNSCARS_AUDIT_RESUME: "",
                ...extra,
              },
            },
            (error, _stdout, stderr) =>
              resolve({
                code: error ? Number(error.code) || 1 : 0,
                stderr,
              }),
          );
        },
      );
      let report;
      try {
        report = JSON.parse(await readFile(reportPath, "utf8"));
      } catch {
        // Mode mismatch is rejected before a report can be written.
      }
      return { ...result, report, reportPath };
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

describe("public audit request scope", () => {
  it("samples a large bilingual catalog deterministically without following its graph", async () => {
    const families = [
      "peliculas",
      "personas",
      "temporadas",
      "festivales",
      "fuentes",
      "premios",
      "archivo",
      "quinielas",
    ];
    const routes = [
      "/",
      "/en",
      ...families.flatMap((family) =>
        Array.from({ length: 75 }, (_, index) => [
          `/${family}/entry-${index}`,
          `/en/${family}/entry-${index}`,
        ]).flat(),
      ),
    ];
    const site = await fixture(routes);
    try {
      const first = await site.run();
      const second = await site.run();
      expect(first.code).toBe(0);
      expect(first.report.mode).toBe("sample");
      expect(first.report.completeness).toBe("sample");
      expect(first.report.fullGraphComplete).toBe(false);
      expect(first.report.visited).toBe(32);
      expect(first.report.requests).toBe(33);
      expect(first.report.selectedUrls).toEqual(second.report.selectedUrls);
      for (const family of families) {
        expect(
          first.report.selectedUrls.some((url: string) =>
            url.endsWith(`/${family}/entry-0`),
          ),
        ).toBe(true);
        expect(
          first.report.selectedUrls.some((url: string) =>
            url.endsWith(`/en/${family}/entry-0`),
          ),
        ).toBe(true);
      }
      expect(
        site.requests.every(
          (request) => request.userAgent === "RunscarsAudit/1.0",
        ),
      ).toBe(true);
      expect(
        site.requests.some((request) => request.url.includes("discovered")),
      ).toBe(false);
    } finally {
      await site.close();
    }
  });

  it("counts redirects and failed retries in one hard request budget", async () => {
    const site = await fixture(
      Array.from({ length: 40 }, (_, i) => `/personas/${i}`),
      {
        fail: true,
        redirect: true,
      },
    );
    try {
      const result = await site.run([], { RUNSCARS_AUDIT_MAX_REQUESTS: "40" });
      expect(result.code).toBe(1);
      expect(site.requests).toHaveLength(40);
      expect(result.report.requests).toBe(40);
      expect(result.report.budgetExhausted).toBe(true);
      expect(result.report.completeness).toBe("incomplete");
      expect(result.report.fullGraphComplete).toBe(false);
      expect(result.report.pendingUrls.length).toBeGreaterThan(0);
    } finally {
      await site.close();
    }
  });

  it("requires explicit full mode to traverse links beyond the sitemap and rejects a mismatched resume", async () => {
    const site = await fixture(["/", "/en"]);
    try {
      const result = await site.run(["--full"]);
      expect(result.code).toBe(0);
      expect(result.report.mode).toBe("full");
      expect(result.report.fullGraphComplete).toBe(true);
      expect(
        site.requests.some(
          (request) => request.url === "/personas/discovered?edition=1",
        ),
      ).toBe(true);
      const resumed = await site.run([], {
        RUNSCARS_AUDIT_RESUME: result.reportPath,
      });
      expect(resumed.code).toBe(1);
      expect(resumed.stderr).toContain("another audit mode");
    } finally {
      await site.close();
    }
  });

  it("resumes discovered graph URLs left pending by a full audit budget", async () => {
    const site = await fixture(["/", "/en"]);
    try {
      const partial = await site.run(["--full"], {
        RUNSCARS_AUDIT_MAX_REQUESTS: "2",
      });
      expect(partial.report.budgetExhausted).toBe(true);
      expect(
        partial.report.pendingUrls.some((url: string) =>
          url.includes("discovered"),
        ),
      ).toBe(true);
      const resumed = await site.run([], {
        RUNSCARS_AUDIT_FULL: "true",
        RUNSCARS_AUDIT_RESUME: partial.reportPath,
      });
      expect(resumed.code).toBe(0);
      expect(resumed.report.mode).toBe("full");
      expect(resumed.report.fullGraphComplete).toBe(true);
      expect(resumed.report.pendingUrls).toEqual([]);
      expect(
        resumed.report.pages.some((page: { url: string }) =>
          page.url.includes("discovered"),
        ),
      ).toBe(true);
    } finally {
      await site.close();
    }
  });
});
