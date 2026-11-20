import { expect, test, type Page } from "@playwright/test";

const site = "http://127.0.0.1:3211";

async function source(page: Page, name: string, width: number, height: number) {
  const data = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fa7b76");
    gradient.addColorStop(0.65, "#643096");
    gradient.addColorStop(1, "#171526");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return canvas.toDataURL().split(",")[1];
  }, { width, height });
  return { name, mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}

test("HD uploads keep a private master and serve responsive hero and cover sizes", async ({ page, browser, request }) => {
  test.setTimeout(95_000);
  await page.goto(site + "/admin");
  await page.getByLabel("Username").fill("test-author");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "New series" }).click();
  await page.getByLabel("Title", { exact: true }).fill("HD Artwork Fixture");
  await page.getByLabel("Cover file", { exact: true }).setInputFiles(await source(page, "portrait.png", 1600, 2400));
  await page.getByRole("button", { name: "Upload cover", exact: true }).click();
  await expect(page.getByText(/Saved rendition 1600 × 2400/)).toBeVisible();
  await page.getByLabel("Hero banner file").setInputFiles(await source(page, "banner.png", 2400, 1350));
  await page.getByRole("button", { name: "Upload hero banner" }).click();
  await expect(page.getByText(/Saved rendition 2400 × 1350/)).toBeVisible();
  await page.getByRole("button", { name: "Save series" }).click();

  const seriesCard = page.locator(".admin-series-list section").filter({ has: page.getByRole("heading", { name: "HD Artwork Fixture" }) });
  await expect(seriesCard).toBeVisible();
  const metadata = await (await page.request.get(site + "/api/admin/export")).json();
  const series = metadata.series.find((item: { title: string }) => item.title === "HD Artwork Fixture");
  const metadataCover = metadata.assets.find((item: { id: string }) => item.id === series.cover_id);
  expect(metadataCover.artwork).toMatchObject({ width: 1600, height: 2400, thumb: 400, card: 800 });
  expect(metadataCover.artwork.blur).toMatch(/^data:image\/webp;base64,/);
  expect((await request.get(`${site}/api/art/${series.cover_id}/master`)).status()).toBe(404);
  expect((await page.request.get(`${site}/api/admin/art/${series.cover_id}/master`)).ok()).toBe(true);

  for (const [width, deviceScaleFactor, rendition] of [[412, 2.625, "card"], [1440, 2, "full"]] as const) {
    const viewport = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor, reducedMotion: "reduce" });
    try {
      const visitor = await viewport.newPage();
      await visitor.goto(site);
      await visitor.getByRole("button", { name: "Show HD Artwork Fixture" }).click();
      const hero = visitor.locator(".hero-art");
      await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.complete && image.currentSrc)).toContain(`/api/art/${series.hero_id}/${rendition}`);
      expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await visitor.goto(site + `/series/${series.slug}`);
      await expect(visitor.locator(".detail-cover")).toHaveAttribute("srcset", /400w.*800w.*1600w/);
    } finally { await viewport.close(); }
  }

  await seriesCard.getByRole("link", { name: "Edit series" }).click();
  await page.getByRole("button", { name: "Re-process images", exact: true }).first().click();
  await expect(page.getByText("Versions regenerated. Save this form to publish the new artwork.")).toBeVisible();
  await page.getByRole("button", { name: "Save series" }).click();
  await expect(seriesCard).toBeVisible();
  const updated = await (await page.request.get(site + "/api/admin/export")).json();
  const newCover = updated.series.find((item: { id: string }) => item.id === series.id).cover_id;
  expect(newCover).not.toBe(series.cover_id);
  expect(updated.assets.find((item: { id: string }) => item.id === newCover)).toMatchObject({ source_id: series.cover_id });
});
