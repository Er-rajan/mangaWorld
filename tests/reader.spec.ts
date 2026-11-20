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
  await expect(page.locator("footer").getByRole("link", { name: /Instagram.*@ur\.rajan/ }))
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

test("Rajan Chapter 1 opens page by page and includes all ten PDF pages in order", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nightfolio:prefs", JSON.stringify({
      mode: "vertical", direction: "rtl", zoom: 100, brightness: 100, background: "ink",
    }));
  });
  await page.goto(site);
  const hero = page.locator(".hero");
  const backdrop = "/manga/rajan-the-thor-curse/backdrop.webp";
  await expect(hero.locator(".hero-art")).toHaveAttribute("src", backdrop);
  await expect(hero.getByRole("link", { name: "Start reading" })).toBeVisible();
  await hero.getByRole("link", { name: "Series details" }).click();
  await expect(page.locator(".detail-backdrop")).toHaveAttribute("src", backdrop);
  expect(await page.locator(".detail-backdrop").evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    return image.naturalWidth;
  })).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Start reading" }).click();
  await expect(page.getByRole("heading", { name: "The Forbidden Temple", level: 1 })).toBeVisible();
  await expect(page.locator(".reader-layout")).toHaveClass(/single/);
  const next = page.getByRole("button", { name: "Next page", exact: true });
  const image = page.locator(".manga-page img");
  const counter = page.locator(".reader-count");
  for (let number = 1; number <= 10; number++) {
    await expect(counter).toHaveText(`${number} / 10`);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", `/manga/rajan-the-thor-curse/chapter-1/page-${String(number).padStart(2, "0")}.webp`);
    expect(await image.evaluate(async (artwork: HTMLImageElement) => {
      await artwork.decode();
      return artwork.naturalWidth;
    })).toBe(1024);
    if (number === 1) await page.keyboard.press("ArrowRight");
    else if (number < 10) await next.click();
  }
  await expect(next).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText("9 / 10");
  await page.reload();
  await expect(counter).toHaveText("9 / 10");
});

test("Rajan Chapter 2 follows Chapter 1 and shows all seventeen pages in filename order", async ({ page }) => {
  const readerPath = "/read/rajan-the-thor-curse";
  await page.goto(site + readerPath + "/chapter-1?page=10");
  await expect(page.locator(".reader-count")).toHaveText("10 / 10");
  await page.locator(".reader-end").getByRole("link", { name: "Next chapter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The First Blood", level: 1 })).toBeVisible();
  await expect(page.locator(".reader-layout")).toHaveClass(/single/);

  const next = page.getByRole("button", { name: "Next page", exact: true });
  const image = page.locator(".manga-page img");
  for (let number = 1; number <= 17; number++) {
    await expect(page.locator(".reader-count")).toHaveText(`${number} / 17`);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", `/manga/rajan-the-thor-curse/chapter-2/page-${String(number).padStart(2, "0")}.webp`);
    expect(await image.evaluate(async (artwork: HTMLImageElement) => {
      await artwork.decode();
      return [artwork.naturalWidth, artwork.naturalHeight];
    })).toEqual(number <= 9 ? [1055, 1491] : number <= 16 ? [1024, 1536] : [1086, 1448]);
    if (number < 17) await next.click();
  }
  await expect(next).toBeDisabled();
  await expect(page.locator(".reader-end").getByRole("link", { name: "Previous chapter", exact: true }))
    .toHaveAttribute("href", readerPath + "/chapter-1");
});

test("Rajan Chapter 3 skips original pages five and six and ends with the four continuation pages", async ({ page }) => {
  const readerPath = "/read/rajan-the-thor-curse";
  await page.goto(site + "/series/rajan-the-thor-curse");
  await expect(page.getByRole("link", { name: "Latest chapter", exact: true })).toHaveAttribute("href", readerPath + "/chapter-3");
  await page.goto(site + readerPath + "/chapter-2?page=17");
  await page.locator(".reader-end").getByRole("link", { name: "Next chapter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Heaven’s Judgment", level: 1 })).toBeVisible();
  await expect(page.locator(".reader-layout")).toHaveClass(/single/);

  const next = page.getByRole("button", { name: "Next page", exact: true });
  const image = page.locator(".manga-page img");
  const originalPages = [1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  for (const [index, number] of originalPages.entries()) {
    await expect(page.locator(".reader-count")).toHaveText(`${index + 1} / ${originalPages.length}`);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", `/manga/rajan-the-thor-curse/chapter-3/page-${String(number).padStart(2, "0")}.webp`);
    expect(await image.evaluate(async (artwork: HTMLImageElement) => {
      await artwork.decode();
      return [artwork.naturalWidth, artwork.naturalHeight];
    })).toEqual([1024, 1536]);
    if (index < originalPages.length - 1) await next.click();
  }
  await expect(next).toBeDisabled();
  await expect(page.locator(".reader-end").getByRole("link", { name: "Previous chapter", exact: true }))
    .toHaveAttribute("href", readerPath + "/chapter-2");
});

test("invalid Supabase credentials leave the bundled catalogue and reader available", async ({ page, request }) => {
  const invalidKeySite = "http://127.0.0.1:3213";
  const home = await page.goto(invalidKeySite);
  expect(home?.status()).toBe(200);
  await expect(page.getByText("The library is having trouble loading.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss library notice" }).click();
  await expect(page.getByText("The library is having trouble loading.", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Rajan: The Thor Curse", level: 1 })).toBeVisible();
  const chapter = await page.goto(invalidKeySite + "/read/the-drowned-city/chapter-1");
  expect(chapter?.status()).toBe(200);
  await expect(page.locator(".reader-count")).toHaveText("Cover · 4 pages");
  const sitemap = await request.get(invalidKeySite + "/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/read/the-drowned-city/chapter-1");
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
    await page.getByRole("button", { name: "Next chapters" }).tap();
    await expect.poll(() => page.locator("#chapter-carousel").evaluate((track) => track.scrollLeft)).toBeGreaterThan(0);
    await page.goto(site + path);
    await page.getByRole("button", { name: "Reader settings", exact: true }).click();
    await expect(page.getByRole("option", { name: "Double-page spread" })).toBeDisabled();
    await page.getByLabel("Reading mode").selectOption("single");
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "Begin chapter" }).click();
    await expect(page.getByRole("complementary", { name: "Tap zones tutorial" })).toBeVisible();
    await page.getByRole("button", { name: "Next page on left" }).tap();
    await expect(page.getByRole("complementary", { name: "Tap zones tutorial" })).toHaveCount(0);
    await expect(page.locator(".reader-count")).toHaveText("2 / 4");
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 115, y: 280 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 255, y: 280 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".reader-count")).toHaveText("3 / 4");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(devices["Pixel 7"].viewport.width);
  } finally { await context.close(); }
});

test("page slider previews a thumbnail and saves a jump with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const chapter = "/read/rajan-the-thor-curse/chapter-1";
  await page.goto(site + chapter + "?page=2");
  const slider = page.getByRole("slider", { name: "Page", exact: true });
  await expect(slider).toHaveValue("2");
  const nextButton = (await page.getByRole("button", { name: "Next page", exact: true }).boundingBox())!;
  const dock = (await page.locator(".reader-bottom").boundingBox())!;
  expect(nextButton.y + nextButton.height).toBeLessThanOrEqual(dock.y);

  const track = (await slider.boundingBox())!;
  await page.mouse.move(track.x + track.width - 4, track.y + track.height / 2);
  await expect(page.locator(".scrubber-thumbnail img")).toHaveAttribute("src", /page-10-preview\.webp$/);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2, { steps: 5 });
  await expect(page.locator(".reader-count")).toHaveText("2 / 10");
  await page.mouse.up();
  await expect(page.locator(".reader-count")).toHaveText("6 / 10");

  await page.getByRole("button", { name: "Reader settings" }).click();
  await page.getByLabel("Page transition").selectOption("page-flip");
  await page.getByRole("button", { name: "Close settings" }).click();
  await slider.press("End");
  await expect(page.getByRole("heading", { name: "End of chapter" })).toBeVisible();
  await expect(page.locator(".manga-page")).toHaveCSS("animation-name", "none");
  await page.goto(site + chapter);
  await expect(slider).toHaveValue("10");
  await expect(page.locator(".reader-layout")).toHaveAttribute("data-transition", "page-flip");
});

test("covered chapters advance into the reader and controls return on pointer movement", async ({ page }) => {
  await page.goto(site + "/read/the-drowned-city/chapter-1");
  await expect(page.getByRole("button", { name: "Begin chapter" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Page", exact: true })).toHaveValue("1");
  await expect(page.locator(".reader-toolbar")).toHaveCSS("opacity", "0");
  await page.mouse.move(200, 250);
  await expect(page.locator(".reader-toolbar")).toHaveCSS("opacity", "1");
});

test("continue reading restores a vertical position within the saved page", async ({ page }) => {
  await page.goto(site + path + "?page=2");
  await expect(page.getByRole("slider", { name: "Page", exact: true })).toHaveValue("2");
  await page.evaluate(() => window.scrollBy(0, 124));
  const position = await page.evaluate(() => window.scrollY);
  await expect.poll(() => page.evaluate((key) => {
    const progress = JSON.parse(localStorage.getItem("nightfolio:progress") ?? "{}");
    return progress[key]?.offset;
  }, path)).toBeGreaterThan(0.1);
  await page.goto(site);
  await page.getByRole("link", { name: /Continue reading/ }).click();
  await expect.poll(() => page.evaluate((saved) => Math.abs(scrollY - saved), position)).toBeLessThan(3);
});

test("the header fits small phones and tablets with Reels navigation", async ({ page }) => {
  await page.goto("http://127.0.0.1:3210");
  for (const width of [320, 360, 581, 650, 960, 1024]) {
    await page.setViewportSize({ width, height: 830 });
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reels" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});
