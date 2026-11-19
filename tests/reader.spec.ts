import { expect, test, devices } from "@playwright/test";
import { artUrl, chapterArt, chapterLink } from "../lib/format";
import type { Series } from "../lib/types";

const site = "http://127.0.0.1:3211";
let series: Series;
let path: string;

test.beforeAll(async ({ request }) => {
  const response = await request.post("http://127.0.0.1:3212/fixtures/reader");
  expect(response.ok()).toBe(true);
  series = await response.json();
  path = chapterLink(series, series.chapters[0]);
});

test("starter catalogue features Rajan and restores The Drowned City Chapter 1", async ({ page, request }) => {
  const starter = "http://127.0.0.1:3210";
  await page.goto(starter);
  await expect(page.getByRole("heading", { name: "Rajan: The Thor Curse", level: 1 })).toBeVisible();
  await expect(page.locator(".series-card h3")).toHaveText(["Rajan: The Thor Curse", "The Drowned City"]);
  await page.getByRole("link", { name: /The Drowned City.*1 chapter/ }).click();
  for (const origin of [starter, site]) {
    if (origin === site) await page.goto(origin + "/series/the-drowned-city");
    await expect(page.getByRole("heading", { name: "The Drowned City", level: 1 })).toBeVisible();
    await expect(page.locator(".detail-cover")).toHaveAttribute("src", "/manga/the-drowned-city/cover.webp");
    await expect(page.locator(".upcoming-row")).toHaveText(/Chapter 2Coming soon/);
    await page.getByRole("link", { name: "Start reading" }).click();
    await expect(page.locator(".reader-count")).toHaveText("Cover · 4 pages");
    await expect(page.locator(".manga-page img")).toHaveCount(4);
    await expect(page.locator(".manga-page img").last()).toHaveAttribute("src", "/manga/the-drowned-city/page-4.webp");
    await expect(page.locator(".reader-end").getByText("Chapter 2 coming soon")).toBeVisible();
    expect((await request.get(origin + "/read/the-drowned-city/chapter-2")).status()).toBe(404);
  }
});

test("Manga World branding, author, footer Instagram and persistent themes", async ({ page, request }) => {
  const starter = "http://127.0.0.1:3210";
  await page.goto(starter);
  await expect(page).toHaveTitle(/Manga World/);
  await expect(page.locator("header").getByRole("link", { name: "Manga World home" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "@ur.rajan" }))
    .toHaveAttribute("href", "https://www.instagram.com/ur.rajan/");
  const picker = page.getByRole("combobox", { name: "Site theme" });
  for (const theme of ["sakura", "ink", "light", "dark", "sakura"]) {
    await picker.selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
  await page.reload();
  await expect(picker).toHaveValue("sakura");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sakura");
  await page.locator("footer").getByRole("link", { name: "About the author" }).click();
  await expect(page.getByRole("heading", { name: "Rajan", exact: true })).toBeVisible();
  const manifest = await (await request.get(starter + "/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Manga World");
});

test("library search, tags, chapter sort and cover fallbacks", async ({ page }) => {
  await page.goto(site);
  await page.getByRole("button", { name: "Sci-fi", exact: true }).click();
  await expect(page.locator(".series-card")).toHaveCount(1);
  await expect(page.locator(".series-card")).toContainText("Reader fixture");
  await page.getByRole("button", { name: "Search manga", exact: true }).click();
  await page.getByRole("searchbox").fill("second fixture");
  await expect(page.getByRole("dialog").getByRole("link", { name: /Second fixture chapter/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".series-card").click();
  await expect(page.locator(".chapter-row").first()).toContainText("Second fixture chapter");
  await page.getByRole("button", { name: "Toggle chapter sort order" }).click();
  await expect(page.locator(".chapter-row").first()).toContainText("First fixture chapter");
  await expect(page.locator(".chapter-row").nth(1).locator("img")).toHaveAttribute("src", artUrl(series.chapters[1].first_page));
  const summary = { ...series.chapters[1], first_page: null };
  expect(chapterArt(series, summary)).toBe(series.cover_id);
  expect(artUrl(chapterArt({ ...series, cover_id: null }, summary))).toBe("/placeholder.webp");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.getByRole("link", { name: "My shelf" }).click();
  await expect(page.locator(".series-card")).toContainText("Reader fixture");
});

test("every reader mode, right-to-left navigation, cover count, progress, bookmark and offline reopen", async ({ page, context }) => {
  await page.goto(site + path);
  await expect(page.locator(".reader-layout")).toHaveClass(/vertical/);
  await expect(page.locator(".reader-count")).toHaveText("Cover · 4 pages");
  await page.getByRole("button", { name: "Begin chapter" }).click();
  await expect(page.locator(".reader-count")).toHaveText("1 / 4");
  await page.getByRole("button", { name: "Reader settings", exact: true }).click();
  await page.getByLabel("Reading mode").selectOption("single");
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.locator(".manga-page")).toHaveCount(1);
  await page.locator(".manga-page img").click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".reader-count")).toHaveText("2 / 4");
  await page.getByRole("button", { name: "Bookmark this page" }).click();
  await expect(page.getByRole("button", { name: "Bookmark this page" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reader settings", exact: true }).click();
  await page.getByLabel("Reading mode").selectOption("spread");
  await expect(page.getByText("Available offline")).toBeVisible({ timeout: 25000 });
  await expect(page.locator(".manga-page")).toHaveCount(2);
  await expect(page.locator(".reader-count")).toHaveText("1–2 / 4");
  await page.getByLabel("Jump to page").selectOption("4");
  await expect(page.locator(".reader-count")).toHaveText("3–4 / 4");
  await expect(page.locator(".reader-progress")).toHaveAttribute("value", "1");

  await context.setOffline(true);
  await page.goto(site + path + "?page=3");
  await expect(page.getByRole("heading", { name: "First fixture chapter", level: 1 })).toBeVisible();
  await expect(page.locator(".reader-count")).toHaveText("3–4 / 4");
  await expect.poll(() => page.locator(".manga-page img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await context.setOffline(false);
  await page.goto(site + "/shelf");
  await expect(page.getByRole("link", { name: /Page 2 of 4/ })).toHaveAttribute("href", path + "?page=2");
});

test("small-screen layout, tap zones and swipe", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3210");
    await expect(page.getByRole("heading", { name: "Browse series" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search manga", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(devices["Pixel 7"].viewport.width);
    await page.goto(site + path);
    await page.getByRole("button", { name: "Reader settings", exact: true }).click();
    await expect(page.getByRole("option", { name: "Double-page spread" })).toBeDisabled();
    await page.getByLabel("Reading mode").selectOption("single");
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "Begin chapter" }).click();
    await page.getByRole("button", { name: "Next page on left" }).tap();
    await expect(page.locator(".reader-count")).toHaveText("2 / 4");
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 115, y: 280 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 255, y: 280 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".reader-count")).toHaveText("3 / 4");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(devices["Pixel 7"].viewport.width);
  } finally { await context.close(); }
});
