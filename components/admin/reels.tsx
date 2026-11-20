"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Reel, ReelCategory, ReelLink } from "@/lib/reels";

type Save = (payload: Record<string, unknown>) => Promise<boolean>;

function ClipForm({ clip, categories, links, busy, save, index, total }: {
  clip?: Reel; categories: ReelCategory[]; links: ReelLink[]; busy: boolean; save: Save; index: number; total: number;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const tags = [...new Set(String(fields.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean))];
    const ok = await save({ operation: "save", id: clip?.id ?? null, title: fields.get("title"), caption: fields.get("caption"),
      youtube: fields.get("youtube"), category_id: fields.get("category"), tags,
      chapter_path: fields.get("chapter") || null, published: fields.has("published") });
    if (ok && !clip) form.reset();
  }

  return <form className="admin-form reel-admin-form" onSubmit={submit}>
    <label>Title<input name="title" required maxLength={120} defaultValue={clip?.title} /></label>
    <label>YouTube or Shorts link<input name="youtube" type="url" required maxLength={512}
      defaultValue={clip ? `https://www.youtube.com/watch?v=${clip.youtube_id}` : ""} /></label>
    <label>Caption<textarea name="caption" rows={2} maxLength={1000} defaultValue={clip?.caption} /></label>
    <div className="form-grid">
      <label>Category<select name="category" required defaultValue={clip?.category_id ?? ""}>
        <option value="">Choose a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Tags <small>Comma separated</small><input name="tags" maxLength={500} defaultValue={clip?.tags.join(", ")} /></label>
    </div>
    <label>Link to manga<select name="chapter" defaultValue={clip?.chapter_path ?? ""}>
      <option value="">No link</option>
      {clip?.chapter_path && !links.some((link) => link.path === clip.chapter_path) && <option value={clip.chapter_path}>Previously linked chapter</option>}
      {links.map((item) => <option key={item.path} value={item.path}>{item.title}</option>)}
    </select></label>
    <label className="checkbox-label"><input type="checkbox" name="published" defaultChecked={clip?.published} /> Published</label>
    <div className="form-actions">
      <button className="button primary" disabled={busy || !categories.length}>{clip ? "Save clip" : "Add clip"}</button>
      {clip && <>
        <button type="button" className="button secondary" disabled={busy || index === 0}
          onClick={() => void save({ operation: "move", id: clip.id, direction: "up" })}>Move up</button>
        <button type="button" className="button secondary" disabled={busy || index >= total - 1}
          onClick={() => void save({ operation: "move", id: clip.id, direction: "down" })}>Move down</button>
        <button type="button" className="button text-danger" disabled={busy} onClick={() => {
          if (window.confirm(`Delete “${clip.title}” and its likes?`)) void save({ operation: "delete", id: clip.id });
        }}>Delete clip</button>
      </>}
    </div>
  </form>;
}

function CategoryForm({ category, busy, save }: { category?: ReelCategory; busy: boolean; save: Save }) {
  return <form className="reel-category-form" onSubmit={async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    const ok = await save({ operation: "save-category", id: category?.id ?? null, name });
    if (ok && !category) form.reset();
  }}>
    <label>{category ? `Category ${category.name}` : "New category"}<input name="name" defaultValue={category?.name} required maxLength={40} /></label>
    <button className="button secondary" disabled={busy}>{category ? "Rename" : "Add category"}</button>
    {category && <button type="button" className="button text-danger" disabled={busy} onClick={() => {
      if (window.confirm(`Delete the “${category.name}” category?`)) void save({ operation: "delete-category", id: category.id });
    }}>Delete</button>}
  </form>;
}

export function ReelsAdmin({ clips, categories, links }: { clips: Reel[]; categories: ReelCategory[]; links: ReelLink[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t update Reels.");
      setMessage("Changes saved.");
      router.refresh();
      return true;
    } catch (error) { setMessage((error as Error).message); return false; }
    finally { setBusy(false); }
  }
  return <>
    <p className="reel-admin-feedback muted" role="status">{message}</p>
    <div className="admin-settings">
      <section className="admin-panel admin-form">
        <h2>Clips</h2>
        <details open={!clips.length}><summary>Add a clip</summary>
          <ClipForm categories={categories} links={links} busy={busy} save={save} index={0} total={clips.length} /></details>
        {clips.map((clip, index) => <details key={clip.id}>
          <summary>{clip.title} <span className="muted">· {clip.published ? "Published" : "Hidden"}</span></summary>
          <ClipForm clip={clip} categories={categories} links={links} busy={busy} save={save} index={index} total={clips.length} />
        </details>)}
      </section>
      <section className="admin-panel admin-form">
        <h2>Categories</h2>
        {categories.map((item) => <CategoryForm key={`${item.id}/${item.name}`} category={item} busy={busy} save={save} />)}
        <CategoryForm busy={busy} save={save} />
      </section>
    </div>
  </>;
}
