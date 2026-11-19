# Manga World

Manga World is Rajan’s personal manga library with a public reader and a single-author publishing dashboard. It runs on Next.js App Router, TypeScript and Tailwind CSS. Vercel Hobby hosts the site, and Supabase Free houses its Postgres database and private artwork.

## Run locally

1. Install Node.js 22 and run `npm ci` from the project directory.
2. Run `npm run dev`, then open [http://localhost:3000](http://localhost:3000). The starter catalogue in `lib/starter.ts` shows **Rajan: The Thor Curse** and **The Drowned City** as coming soon.
3. To use the admin, complete the Supabase setup below, copy `.env.example` to `.env.local`, fill it out, and restart the server. Open [http://localhost:3000/admin](http://localhost:3000/admin) to sign in. Run `supabase/seed.sql` in the Supabase SQL Editor to make the starter titles editable. Set `SHOW_DEMO_WHEN_EMPTY=false` if you want an empty public catalogue before adding titles.
4. To test installable and offline behavior locally, run `npm run build` and then `npm start`. The service worker is enabled in production builds on localhost or HTTPS.

## Set up Supabase Free

1. In the [Supabase dashboard](https://supabase.com/dashboard), create a project in a **Free** organization. Pick a region near your readers if they are concentrated in one area.
2. Open **SQL Editor**, create a new query, paste `supabase/migrations/001_nightfolio.sql`, and run it once on the new project. The transaction creates the schema, RLS policies, server-only database functions, and the private `manga-art` Storage bucket. Run `supabase/seed.sql` in a second query to add the two starter titles. Under **Storage**, verify the bucket is private and accepts WebP. Its file limit is 8,000,000 bytes per converted object.
3. In **Connect** or **Project Settings → API Keys**, copy the project URL, the publishable key and the secret key. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. The legacy anon and service-role keys also work in the corresponding slots. Keep the secret key server-side.
4. Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` at least 16 characters long. Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and set `ADMIN_SESSION_SECRET`. Keep `.env.local` out of Git. Rotating the admin username, password, or session secret invalidates existing sessions.

### Data and access

| Table | Purpose |
| --- | --- |
| `series` | Titles, descriptions, tags, status and optional cover |
| `chapters` | Chapter number, release time, visibility, cover, note and counters |
| `chapter_pages` | Ordered references to individual artwork with dimensions and alt text |
| `assets` | Storage references and cleanup state |
| `site_settings` | Author bio, optional character profiles, watermark and comments preferences |
| `chapter_visitors` and `login_attempts` | Private reaction and login rate-limit state |

Chapter metadata, images and reactions are available publicly only when the chapter is marked **Published** and its release timestamp is due. Postgres evaluates the timestamp on each new request. The application issues exact-path signed upload URLs after admin authentication and redirects authorized image reads to short-lived signed downloads. Storage receives the image bytes directly in both directions. Postgres saves the page order and chapter metadata in one transaction after checking uploaded files. The browser associates views and likes with a random local identifier. Views are counted once per chapter, browser and UTC day.

The dashboard’s **Export metadata** button downloads settings, series, chapters, page order, storage identifiers and aggregate counts as JSON. For a complete backup, retain your original artwork and download the `manga-art` objects separately. The JSON export contains metadata only. **Clean up unused artwork** permanently removes batches of up to 50 unreferenced artwork sets uploaded more than three hours ago. Run it after replacing or deleting a large batch once your edits have been saved. An offline copy previously downloaded by a reader can remain on that reader’s device.

## Publish a series and chapter

1. Sign in at `/admin` and select **Edit series** for Rajan or **New series** for a new title. Enter its title, description, comma-separated tags and status.
2. Select **Choose cover**, pick a PNG, JPG or WebP, and adjust the 2:3 preview with the zoom and position sliders. Click **Upload cover**, then **Save series**.
3. Select **New chapter** on that series. Enter the number and title. Add an optional note and chapter cover the same way. The optional chapter cover opens the reader and is outside the page count.
4. Drop the chapter’s images together or choose one PDF. Wait for the thumbnails. The browser sorts image filenames naturally and converts PDF pages in document order. Drag the thumbnail handles or use the move buttons to set the order. Use the replace and remove controls to fix individual pages and enter alt text where appropriate.
5. Set **Draft** to keep the chapter private. Choose **Published** and leave the release time blank for immediate release, or enter a future date and time in your device’s time zone to schedule it. Click **Save chapter**. The dashboard lists scheduled times in UTC.

The browser converts artwork to a full-size WebP and a thumbnail before uploading. Each chapter supports up to 250 pages and each source file up to 100 MB. Keep the original images and PDFs. Public previews use the chapter cover, first page, series cover, then a placeholder in that order.

## Deploy on Vercel Hobby

1. Complete the Supabase setup above.
2. Push the project to a Git repository in your personal account. Include `package-lock.json`, the migration and `supabase/seed.sql`. Exclude `.env.local`, `node_modules` and `.next`.
3. In a **Hobby** account, select **Add New → Project** and import the repository. Use **Next.js** as the framework preset, the repository root as **Root Directory**, Node.js **22.x**, and the default build and output settings. The build copies the local pdf.js worker and its assets automatically.
4. Add the Supabase and admin environment variables from `.env.example` for **Production**. If you enable preview deployments that connect to a database, use a separate test database and credentials. 
5. Deploy. Set `SITE_URL` to the final public HTTPS origin from the project’s **Domains** page and redeploy to apply the canonical URLs. Check the public home, `/sitemap.xml`, and `/admin` and publish a small chapter to confirm uploads in your project.

### Free-tier capacity

- Supabase Free includes 500 MB of database space per project, 1 GB of file storage and 5 GB each of cached and uncached egress. The platform permits files up to 50 MB on Free. Manga World’s bucket cap is 8 MB per converted image, and each page or cover has two WebP variants. For example, a 20-page chapter averaging 250 KB per full page is about 5 MB to download in full. That’s about 1,000 such downloads in the 5 GB uncached allowance before previews, metadata and other transfers. Actual egress depends on compression and caching. Free projects can pause after a week of low activity. Monitor usage and restore paused projects from the dashboard. [Supabase pricing](https://supabase.com/pricing) · [Bandwidth](https://supabase.com/docs/guides/storage/serving/bandwidth) · [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- Vercel Hobby is for personal, non-commercial use and has usage caps. The app uses browser-side image processing and time-based database publishing, so it needs neither a paid image transformation service nor a scheduled Vercel job. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Vercel Web Analytics is optional. Switch it on in the dashboard and set `ENABLE_ANALYTICS=true` to activate it. Leave it off or set it to `false` to disable it. Hobby includes up to 50,000 Web Analytics events within its published allowance. [Web Analytics limits](https://vercel.com/docs/analytics/limits-and-pricing)

### Install, offline and comments

Use the browser’s **Install app** or **Add to Home Screen** control where available. Open a chapter online and wait for **Available offline** in **Reader settings**. Reopen the chapter directly or from a bookmark or reading history under **My shelf**. The service worker keeps up to three chapters on the device, subject to browser storage availability. Offline preparation downloads the chapter’s images once. Reader preferences, progress, bookmarks and followed series live in localStorage.

For optional comments, enable **Discussions** in a public GitHub repository, install the Giscus app for it, and use [giscus.app](https://giscus.app/) to populate the four `GISCUS_*` variables. Then turn on **Enable Giscus comments** under **Site settings**. Commenters sign in to GitHub. The author name, bio and optional reader watermark are also editable there. Add entries under **Character profiles** to make the profiles page available from About.

## Project structure and verification

- `app/` contains public, reader, admin and API routes, plus metadata and the PWA manifest.
- `components/` contains the library, reader and admin interfaces.
- `lib/` contains data access, authentication, browser preferences and client-side upload processing.
- `public/` contains the offline worker, icons, placeholders and original site banner.
- `supabase/migrations/` contains the database and Storage setup.

Run `npm run typecheck`, `npm run test:db`, and `npm run build`. To run browser tests, install Chromium with `npx playwright install chromium`, then run `npm test`. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Microsoft Edge. The browser tests start two local production servers and a disposable Storage/API fixture backed by PGlite. They exercise the actual Next.js handlers and migration without a hosted account or billable dependencies.
