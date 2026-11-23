import { devices, expect, test } from "@playwright/test";

const site = "http://127.0.0.1:3211";

test("admin publishes and orders Reels, and the mobile feed plays one clip and saves one like", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  try {
    const page = await context.newPage();
    await page.goto(site + "/admin/reels");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    await page.getByLabel("Username").fill("test-author");
    await page.getByLabel("Password", { exact: true }).fill("local-fixture-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Manage Reels" }).click();

    await page.getByLabel("New category").fill("Production diary");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByLabel("Category Production diary")).toBeVisible();
    for (const [title, video, published] of [["Temple teaser", "aqz-KE-bpKQ", true], ["Drawing the city", "M7lc1UVf-VE", true],
      ["Private cut", "abcdef12345", false]] as const) {
      const add = page.locator("details").filter({ has: page.getByText("Add a clip", { exact: true }) });
      if (!await add.getByLabel("Title").isVisible()) await add.locator("summary").click();
      await add.getByLabel("Title").fill(title);
      await add.getByLabel("YouTube or Shorts link").fill(`https://www.youtube.com/shorts/${video}`);
      await add.getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Production diary" });
      await add.getByLabel("Published").setChecked(published);
      await add.getByRole("button", { name: "Add clip" }).click();
      await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    }
    const drawing = page.locator("details").filter({ has: page.getByText(/Drawing the city · Published/) });
    await drawing.locator("summary").click();
    await drawing.getByRole("button", { name: "Move up" }).click();
    await expect(page.locator(".admin-settings details summary").nth(1)).toContainText("Drawing the city");

    await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ body: "<html></html>", contentType: "text/html" }));
    await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: `
      window.YT = { Player: class {
        constructor(frame, { events }) { this.events = events; setTimeout(() => events.onReady({ target: this }), 0); }
        playVideo() { this.events.onStateChange({ data: 1 }); } pauseVideo() { this.events.onStateChange({ data: 2 }); }
        mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
        getCurrentTime() { return 2; } getDuration() { return 8; } destroy() {}
      } }; window.onYouTubeIframeAPIReady();` }));
    await page.goto(site + "/reels");
    await expect(page.getByRole("heading", { name: "Reels", exact: true })).toBeVisible();
    await expect(page.getByText("Private cut")).toHaveCount(0);
    await expect(page.locator(".reel-feed iframe")).toHaveCount(1);
    await expect(page.locator(".reel-feed iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
    await page.getByRole("combobox", { name: "Site theme" }).selectOption("rabbit");
    await expect(page.locator(".reel-placeholder")).toHaveCSS("background-color", "rgb(241, 234, 247)");
    await page.getByRole("button", { name: "Unmute", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
    const card = page.locator(".reel-slide").first();
    await card.getByRole("button", { name: "Like clip, 0 likes" }).click();
    await expect(card.getByRole("button", { name: "Like clip, 1 like" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next clip" }).tap();
    await expect(page.locator(".reel-feed iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/);
    await expect(page.locator(".reel-feed iframe")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(devices["Pixel 7"].viewport.width);
  } finally { await context.close(); }
});
