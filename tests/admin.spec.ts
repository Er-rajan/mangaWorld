import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const site = "http://127.0.0.1:3211";

function pdf() {
  const body = "0.1 0.1 0.1 rg 20 20 110 150 re f\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 5 0 R >>",
    `<< /Length ${body.length} >>\nstream\n${body}endstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const start = content.length;
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return start;
  });
  const start = content.length;
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(content, "ascii");
}

test("admin crops and uploads covers, bulk uploads and reorders images, converts PDF, schedules and exports", async ({ page, request, context }) => {
  const directUploads: string[] = [];
  page.on("request", (incoming) => {
    if (incoming.method() === "PUT" && incoming.url().includes("127.0.0.1:3212/storage/v1/object/upload/sign/")) directUploads.push(incoming.url());
  });
  expect((await request.get(site + "/api/admin/export")).status()).toBe(401);
  await page.goto(site + "/admin");
  await page.getByLabel("Username").fill("test-author");
  await page.getByLabel("Password").fill("incorrect");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect username or password.", { exact: true })).toBeVisible();
  await page.getByLabel("Password").fill("local-fixture-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "New series" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Fixture Manga");
  await page.getByLabel("Description").fill("An original test story.");
  await page.getByLabel("Genres and tags").fill("Action, Mystery");
  const source = await readFile("public/icon-512.png");
  const cover = { name: "cover.png", mimeType: "image/png", buffer: source };
  await page.getByLabel("Cover file").setInputFiles(cover);
  await expect(page.getByRole("img", { name: "Cropped cover preview" })).toBeVisible();
  await expect(page.getByText(/This crop supplies 341 × 512 pixels/)).toBeVisible();
  await page.getByRole("button", { name: "Upload cover" }).click();
  await expect(page.getByRole("button", { name: "Replace cover" })).toBeVisible();
  await page.getByRole("button", { name: "Save series" }).click();
  const fixtureSeries = page.locator(".admin-series-list section").filter({ has: page.getByRole("heading", { name: "Fixture Manga" }) });
  await fixtureSeries.getByRole("link", { name: "New chapter" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Opening Rails");
  await page.getByLabel("Cover file").setInputFiles(cover);
  await page.getByRole("button", { name: "Upload cover" }).click();
  await expect(page.getByRole("button", { name: "Replace cover" })).toBeVisible();
  await page.getByLabel("Chapter page files").setInputFiles(["10.png", "2.png", "1.png"].map((name) => ({
    name, mimeType: "image/png", buffer: source,
  })));
  const files = page.locator(".edit-page > p");
  await expect(files).toHaveText(["1.png", "2.png", "10.png"]);
  const handle = page.getByRole("button", { name: "Drag page 1" });
  await handle.scrollIntoViewIfNeeded();
  const start = (await handle.boundingBox())!;
  const end = (await page.locator(".edit-page").nth(1).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, start.y + start.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(files).toHaveText(["2.png", "1.png", "10.png"]);
  await page.getByLabel("Replacement image for page 2").setInputFiles({ ...cover, name: "replacement.png" });
  await expect(files).toHaveText(["2.png", "replacement.png", "10.png"]);
  await page.getByRole("button", { name: "Remove page 3" }).click();
  await page.getByLabel("Alt text for page 1").fill("A handwritten railway ticket.");
  await page.getByLabel("Visibility").selectOption("published");
  await page.getByLabel("Release date and time").fill("2099-01-01T09:00");
  await page.getByRole("button", { name: "Save chapter" }).click();
  const edit = page.getByRole("link", { name: /Opening Rails/ });
  await expect(edit).toContainText("Scheduled");
  const metadata = await (await page.request.get(site + "/api/admin/export")).json();
  const slug = metadata.series.find((item: { title: string }) => item.title === "Fixture Manga").slug;
  const chapter = metadata.chapters.find((item: { title: string }) => item.title === "Opening Rails");
  const orderedPages = metadata.pages.filter((item: { chapter_id: string }) => item.chapter_id === chapter.id);
  expect(orderedPages.map((item: { filename: string }) => item.filename)).toEqual(["2.png", "replacement.png"]);
  const seriesPath = `/series/${slug}`;
  const chapterPath = `/read/${slug}/${chapter.id}`;
  const coverPath = `/api/art/${chapter.cover_id}/thumb`;
  const teaser = await (await request.get(site + seriesPath)).text();
  expect(teaser).toContain("Scheduled for");
  expect(teaser).not.toContain("Opening Rails");
  expect((await request.get(site + coverPath)).status()).toBe(404);
  const hidden = await request.get(site + chapterPath);
  expect(hidden.status()).toBe(404);
  expect(await hidden.text()).not.toContain("A handwritten railway ticket.");
  await edit.click();
  await page.getByLabel("Release date and time").fill("");
  await page.getByRole("button", { name: "Save chapter" }).click();
  await expect(edit).toContainText("Published");
  const released = await request.get(site + coverPath);
  expect(released.headers()["content-type"]).toBe("image/webp");

  await fixtureSeries.getByRole("link", { name: "New chapter" }).click();
  await page.getByLabel("Title", { exact: true }).fill("PDF Journey");
  await page.getByLabel("Chapter page files").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: pdf() });
  await expect(files).toHaveText(["page-001.webp", "page-002.webp"], { timeout: 30000 });
  await page.getByLabel("Visibility").selectOption("published");
  await page.getByRole("button", { name: "Save chapter" }).click();
  await expect(page.getByRole("link", { name: /PDF Journey/ })).toContainText("Published");
  const exported = await (await page.request.get(site + "/api/admin/export")).json();
  const pdfChapter = exported.chapters.find((item: { title: string }) => item.title === "PDF Journey");
  const converted = exported.pages.filter((item: { chapter_id: string }) => item.chapter_id === pdfChapter.id);
  expect(converted).toHaveLength(2);
  expect(converted.some((item: { width: number; height: number }) => item.height > item.width)).toBe(true);
  expect(converted.some((item: { width: number; height: number }) => item.width > item.height)).toBe(true);
  expect(directUploads).toHaveLength(16);

  await page.goto(site + seriesPath);
  await expect(page.locator(".chapter-row").first().locator("img")).toHaveAttribute("src", /\/api\/art\/.+\/thumb/);
  await page.goto(site + chapterPath);
  await expect(page.locator(".reader-count")).toHaveText("Cover · 2 pages");
  await expect(page.getByAltText("A handwritten railway ticket.")).toBeVisible();
  await expect(page.getByText("1 view", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "0 likes" }).click();
  await expect(page.getByRole("button", { name: "1 like", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reader settings", exact: true }).click();
  await expect(page.getByText("Available offline")).toBeVisible({ timeout: 25000 });
  await context.setOffline(true);
  await page.goto(site + chapterPath + "?page=1");
  await expect.poll(() => page.locator(".manga-page img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await context.setOffline(false);
});
