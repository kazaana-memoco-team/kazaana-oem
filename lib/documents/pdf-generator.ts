/**
 * Generate a PDF from an HTML string.
 * - Local dev (NODE_ENV=development): full `puppeteer` (auto-bundled Chromium)
 * - Production (Vercel etc.): `puppeteer-core` + `@sparticuz/chromium`
 */

import "server-only";
import type { Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "development") {
    // In dev, use the full puppeteer package (downloads its own Chromium)
    const puppeteer = (await import("puppeteer")).default;
    // The full puppeteer's Browser is structurally compatible with puppeteer-core's
    return (await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    })) as unknown as Browser;
  }

  // Production: use the slim chromium tailored for serverless
  const [puppeteerCore, chromium] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);

  return puppeteerCore.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  return browserPromise;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const data = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(data);
  } finally {
    await page.close();
  }
}
