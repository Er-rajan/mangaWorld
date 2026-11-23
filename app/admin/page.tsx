import { Download, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { Art } from "@/components/art";
import { AdminLogin, SettingsForm } from "@/components/admin/forms";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { library } from "@/lib/db";
import { latestBundledChapterNumber } from "@/lib/bundled-chapters";

export default async function AdminPage() {
  if (!await isAdmin()) return <main id="main" className="login-page site-width"><AdminLogin enabled={adminConfigured()} /></main>;
  const { series, settings } = await library(true);
  return <main id="main" className="site-width admin-content">
    <div className="split-heading admin-title">
      <div><h1>Manage library</h1><p>Create series, upload chapters, and schedule releases.</p></div>
      <div className="form-actions">
        <Link className="button secondary" href="/admin/reels" prefetch={false}>Manage Reels</Link>
        <Link className="button secondary" href="/admin/artwork" prefetch={false}>Re-process images</Link>
        <a className="button secondary" href="/api/admin/export"><Download size={18} /> Export metadata</a>
        <Link className="button primary" href="/admin/series/new"><Plus size={18} /> New series</Link>
      </div>
    </div>
    {series.length ? <div className="admin-series-list">{series.map((series) => {
      const bundledNumber = latestBundledChapterNumber(series.slug);
      return <section key={series.id} id={`series-${series.id}`} className="admin-panel">
        <div className="split-heading admin-series-heading">
          <div><Art id={series.cover_id} preview /><h2>{series.title}</h2></div>
          <div className="form-actions">
            <Link className="button secondary" href={`/admin/series/${series.id}`}><Pencil size={16} /> Edit series</Link>
            <Link className="button secondary" href={`/admin/series/${series.id}/chapters/new`}><Plus size={17} /> New chapter</Link>
          </div>
        </div>
        {series.chapters.length ? <ul className="admin-chapters">{series.chapters.map((chapter) => {
          const scheduled = Date.parse(chapter.release_at) > Date.now();
          const status = !chapter.published ? "Draft" : scheduled ? "Scheduled" : "Published";
          return <li key={chapter.id}>
            <Link href={`/admin/series/${series.id}/chapters/${chapter.id}`}>
              <span><small>Chapter {chapter.number}</small><strong>{chapter.title}</strong></span>
              <span className="chapter-admin-status">
                <span>{status}</span>{scheduled && chapter.published && <time dateTime={chapter.release_at}>{new Date(chapter.release_at).toISOString().slice(0, 16).replace("T", " ")} UTC</time>}
              </span><Pencil size={16} />
            </Link>
          </li>;
        })}</ul> : <p className="muted">{bundledNumber
          ? `Chapter ${bundledNumber} is available on the site. The next upload starts at Chapter ${bundledNumber + 1}.`
          : "This series has no chapters yet."}</p>}
      </section>;
    })}</div> : <p className="empty-box">Create your first series to start uploading chapters.</p>}
    <SettingsForm settings={settings} />
  </main>;
}
