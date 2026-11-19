"use client";

import { CalendarClock, LogOut, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Chapter, Series, Settings } from "@/lib/types";
import { latestBundledChapterNumber } from "@/lib/bundled-chapters";
import { adminRequest } from "@/lib/upload";
import { CoverInput } from "./cover-input";
import { PagesInput, type EditablePage } from "./pages-input";

export function AdminLogin({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="admin-panel login-form" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const fields = new FormData(event.currentTarget);
    try {
      await adminRequest({ action: "login", username: fields.get("username"), password: fields.get("password") });
      window.location.reload();
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }}>
    <h1>Admin sign-in</h1>
    {!enabled && <p>Set up Supabase and the admin environment variables in <code>.env.example</code> to enable sign-in.</p>}
    <label>Username<input name="username" autoComplete="username" required maxLength={200} disabled={!enabled || busy} /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={512} disabled={!enabled || busy} /></label>
    <button className="button primary" disabled={!enabled || busy}>{busy ? "Signing in…" : "Sign in"}</button>
    {message && <p className="form-error" role="alert">{message}</p>}
  </form>;
}

export function AdminLogout() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <div>
    <button type="button" className="button secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await adminRequest({ action: "logout" }); window.location.assign("/admin"); }
      catch (error) { setMessage((error as Error).message); setBusy(false); }
    }}><LogOut size={17} /> Sign out</button>
    {message && <small role="alert">{message}</small>}
  </div>;
}

export function AdminSeriesForm({ series }: { series?: Series }) {
  const [cover, setCover] = useState(series?.cover_id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="admin-panel admin-form" onSubmit={async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const { id } = await adminRequest<{ id: string }>({ action: "series", id: series?.id ?? null, revision: series?.revision ?? 0,
        payload: { title: fields.get("title"), description: fields.get("description"), cover_id: cover,
          status: fields.get("status"), tags: [...new Set(String(fields.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean))] } });
      window.location.assign(`/admin#series-${id}`);
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }}>
    <label>Title<input name="title" required maxLength={120} defaultValue={series?.title} /></label>
    <label>Description<textarea name="description" rows={5} maxLength={6000} defaultValue={series?.description} /></label>
    <div className="form-grid">
      <label>Genres and tags <small>Comma separated</small><input name="tags" defaultValue={series?.tags.join(", ")} maxLength={820} /></label>
      <label>Status<select name="status" defaultValue={series?.status ?? "ongoing"}><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></label>
    </div>
    <CoverInput value={cover} onChange={setCover} onBusy={setBusy} disabled={busy} />
    <div className="form-actions">
      <button className="button primary" disabled={busy}><Save size={18} /> Save series</button>
      {series && <DeleteEntry kind="series" id={series.id} revision={series.revision} label={series.title} disabled={busy} onBusy={setBusy} onError={setMessage} />}
    </div>
    {message && <p className="form-error" role="alert">{message}</p>}
  </form>;
}

function localTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function AdminChapterForm({ series, chapter }: { series: Series; chapter?: Chapter }) {
  const [cover, setCover] = useState(chapter?.cover_id ?? null);
  const [pages, setPages] = useState<EditablePage[]>((chapter?.pages ?? []).map((page, index) => ({ ...page, key: `${page.asset_id}:${index}` })));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(chapter?.published ?? false);
  const [date, setDate] = useState("");
  const [zone, setZone] = useState("");
  useEffect(() => {
    if (chapter) setDate(localTime(chapter.release_at));
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [chapter]);
  const number = chapter?.number
    ?? (Math.max(series.chapters.at(-1)?.number ?? 0, latestBundledChapterNumber(series.slug)) + 1);

  return <form className="admin-panel admin-form" onSubmit={async (event) => {
    event.preventDefault();
    if (published && !pages.length) { setMessage("Add at least one page before publishing."); return; }
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const release = chapter && date === localTime(chapter.release_at) ? chapter.release_at
        : date ? new Date(date).toISOString() : new Date().toISOString();
      await adminRequest({ action: "chapter", id: chapter?.id ?? null, revision: chapter?.revision ?? 0,
        payload: { series_id: series.id, number: Number(fields.get("number")), title: fields.get("title"),
          note: fields.get("note"), published, cover_id: cover, release_at: release,
          pages: pages.map(({ asset_id, width, height, filename, alt }) => ({ asset_id, width, height, filename, alt })) } });
      window.location.assign(`/admin#series-${series.id}`);
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }}>
    <div className="form-grid chapter-fields">
      <label>Chapter number<input name="number" type="number" min="0" max="999999.99" step=".01" required defaultValue={number} /></label>
      <label>Title<input name="title" required defaultValue={chapter?.title} maxLength={120} /></label>
    </div>
    <div className="publish-fields">
      <label>Visibility<select value={published ? "published" : "draft"} onChange={(event) => setPublished(event.target.value === "published")}>
        <option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label>Release date and time<input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <p><CalendarClock size={18} /> <span>Time zone: {zone || "this device"}. A future date schedules a published chapter. Leave the date blank to use the current time.</span></p>
    </div>
    <label>Author’s note <small>Optional</small><textarea name="note" rows={3} maxLength={6000} defaultValue={chapter?.note} /></label>
    <CoverInput value={cover} onChange={setCover} onBusy={setBusy} disabled={busy} />
    <PagesInput pages={pages} setPages={setPages} busy={busy} onBusy={setBusy} />
    <div className="form-actions">
      <button className="button primary" disabled={busy}><Save size={18} /> Save chapter</button>
      {chapter && <DeleteEntry kind="chapter" id={chapter.id} revision={chapter.revision} label={chapter.title} disabled={busy} onBusy={setBusy} onError={setMessage} />}
    </div>
    {message && <p className="form-error" role="alert">{message}</p>}
  </form>;
}

function DeleteEntry({ kind, id, revision, label, disabled, onBusy, onError }: {
  kind: "series" | "chapter"; id: string; revision: number; label: string; disabled: boolean;
  onBusy: (value: boolean) => void; onError: (value: string) => void;
}) {
  return <button className="button text-danger" type="button" disabled={disabled} onClick={async () => {
    const details = kind === "series" ? " This also deletes its chapters and page metadata." : "";
    if (!window.confirm(`Delete “${label}” permanently?${details}`)) return;
    onBusy(true);
    try { await adminRequest({ action: "delete", kind, id, revision }); window.location.assign("/admin"); }
    catch (error) { onError((error as Error).message); onBusy(false); }
  }}><Trash2 size={17} /> Delete {kind}</button>;
}

export function SettingsForm({ settings, commentsConfigured }: { settings: Settings; commentsConfigured: boolean }) {
  const [message, setMessage] = useState("");
  const [cleanup, setCleanup] = useState("");
  const [busy, setBusy] = useState(false);
  const [characters, setCharacters] = useState(settings.characters.map((profile, index) => ({ ...profile, key: index })));
  const [profileKey, setProfileKey] = useState(characters.length);
  return <div className="admin-settings">
    <form className="admin-panel admin-form" onSubmit={async (event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setBusy(true);
      setMessage("");
      try {
        await adminRequest({ action: "settings", payload: { author: fields.get("author"), about: fields.get("about"),
          watermark: fields.has("watermark"), comments: fields.has("comments"),
          characters: characters.map(({ name, series, bio }) => ({ name, series, bio })) } });
        setMessage("Settings saved.");
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <h2>Site settings</h2>
      <label>Author name<input name="author" maxLength={100} defaultValue={settings.author} /></label>
      <label>About the author<textarea name="about" maxLength={6000} defaultValue={settings.about} rows={3} /></label>
      <details className="profile-settings">
        <summary>Character profiles ({characters.length})</summary>
        {characters.map((profile, index) => <div key={profile.key} className="profile-edit">
          <div className="form-grid">
            <label>Name<input value={profile.name} maxLength={100} required onChange={(event) => {
              setCharacters((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item));
            }} /></label>
            <label>Series<input value={profile.series} maxLength={120} onChange={(event) => {
              setCharacters((items) => items.map((item, i) => i === index ? { ...item, series: event.target.value } : item));
            }} /></label>
          </div>
          <label>Bio<textarea rows={2} maxLength={1600} value={profile.bio} onChange={(event) => {
            setCharacters((items) => items.map((item, i) => i === index ? { ...item, bio: event.target.value } : item));
          }} /></label>
          <button type="button" className="button text-danger" disabled={busy} onClick={() => setCharacters((items) =>
            items.filter((item) => item.key !== profile.key))}><Trash2 size={16} /> Remove profile</button>
        </div>)}
        <button type="button" className="button secondary" disabled={busy || characters.length >= 30} onClick={() => {
          setCharacters((items) => [...items, { key: profileKey, name: "", series: "", bio: "" }]);
          setProfileKey((key) => key + 1);
        }}><Plus size={17} /> Add profile</button>
      </details>
      <label className="checkbox-label"><input name="watermark" type="checkbox" defaultChecked={settings.watermark} /> Display author name over reader images</label>
      <p className="muted">The watermark is a visual overlay. It doesn’t prevent copying.</p>
      <label className="checkbox-label"><input name="comments" type="checkbox" defaultChecked={settings.comments} /> Enable Giscus comments</label>
      {!commentsConfigured && <p className="muted">Set the Giscus environment variables to show comments in the reader.</p>}
      <button className="button primary" disabled={busy}><Save size={17} /> Save settings</button>
      <p className="muted" aria-live="polite">{message}</p>
    </form>
    <section className="admin-panel admin-form">
      <h2>Storage</h2>
      <p>Remove unreferenced images uploaded more than three hours ago to reclaim space after edits or failed uploads.</p>
      <button className="button text-danger" type="button" disabled={busy} onClick={async () => {
        if (!window.confirm("Permanently remove unused artwork from Storage?")) return;
        setBusy(true);
        try {
          const { removed } = await adminRequest<{ removed: number }>({ action: "cleanup" });
          setCleanup(removed ? `Removed ${removed} unused artwork sets.` : "No unused artwork to remove.");
        } catch (error) { setCleanup((error as Error).message); }
        finally { setBusy(false); }
      }}><Trash2 size={17} /> Clean up unused artwork</button>
      <p className="muted" aria-live="polite">{cleanup}</p>
    </section>
  </div>;
}
