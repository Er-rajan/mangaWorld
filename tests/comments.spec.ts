import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const site = "http://127.0.0.1:3211";
const chapter = "/read/the-drowned-city/chapter-1";
const endpoint = `${site}/api/comments?chapter=${encodeURIComponent(chapter)}`;

test("any visitor can read a comment posted by a different visitor", async ({ page, browser, request }) => {
  let allowScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { allowScripts = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto(site + chapter, { waitUntil: "commit" });
    await page.getByText("Chapter comments", { exact: true }).click();
    await expect(page.getByText("Loading comments…")).toBeVisible();
  } finally { allowScripts(); }
  await expect(page.getByText("No comments yet.")).toBeVisible();
  await expect(page.locator(".chapter-comments-content")).toHaveCSS("grid-template-columns", /^\d+(\.\d+)?px \d+(\.\d+)?px$/);
  await page.getByLabel("Name", { exact: true }).fill("Manga reader");
  const message = "Loved the artwork!\n<script>plain text</script>";
  await page.getByLabel("Comment", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Comment posted.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Posted comments" })).toContainText("Manga reader");
  await expect(page.getByLabel("Comment", { exact: true })).toHaveValue("");

  const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await visitor.goto(site);
    await visitor.getByRole("combobox", { name: "Site theme" }).selectOption("rabbit");
    await visitor.goto(site + chapter);
    await expect(visitor.locator("html")).toHaveAttribute("data-theme", "rabbit");
    await visitor.getByText("Chapter comments", { exact: true }).click();
    await expect(visitor.locator(".chapter-comments")).toHaveCSS("background-color", "rgb(255, 253, 253)");
    await expect(visitor.locator(".chapter-comments-content")).toHaveCSS("grid-template-columns", /^\d+(\.\d+)?px$/);
    const list = visitor.getByRole("list", { name: "Posted comments" });
    await expect(list).toContainText("Manga reader");
    await expect(list).toContainText("<script>plain text</script>");
    await expect(list.locator("script")).toHaveCount(0);

    await visitor.goto(`${site}/read/rajan-the-thor-curse/chapter-1`);
    await visitor.getByText("Chapter comments", { exact: true }).click();
    await expect(visitor.getByText("No comments yet.")).toBeVisible();
  } finally { await visitor.close(); }

  const invalid = await request.post(endpoint, { headers: { Origin: site }, data: { requestId: randomUUID(), name: " ", body: "Missing name" } });
  expect(invalid.status()).toBe(400);
  const missing = await request.get(`${site}/api/comments?chapter=${encodeURIComponent("/read/the-drowned-city/chapter-2")}`);
  expect(missing.status()).toBe(404);
});
