"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Replace, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Art } from "@/components/art";
import type { PageArt } from "@/lib/types";
import { maxPages, prepareImage, processFiles, uploadArtwork } from "@/lib/upload";

export type EditablePage = PageArt & { key: string };

function SortablePage({ page, index, length, disabled, move, remove, replace, editAlt }: {
  page: EditablePage; index: number; length: number; disabled: boolean;
  move: (delta: -1 | 1) => void; remove: () => void; replace: (file: File) => void; editAlt: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.key, disabled });
  const input = useRef<HTMLInputElement>(null);
  return <li ref={setNodeRef} className={`edit-page ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <div className="edit-page-art">
      <Art id={page.asset_id} alt={`Preview of page ${index + 1}`} preview />
      <span>{index + 1}</span>
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Drag page ${index + 1}`} disabled={disabled}><GripVertical size={19} /></button>
    </div>
    <p title={page.filename}>{page.filename}</p>
    <div className="edit-page-actions">
      <button type="button" className="icon-button" aria-label={`Move page ${index + 1} earlier`} disabled={disabled || index === 0} onClick={() => move(-1)}><ArrowUp size={16} /></button>
      <button type="button" className="icon-button" aria-label={`Move page ${index + 1} later`} disabled={disabled || index + 1 === length} onClick={() => move(1)}><ArrowDown size={16} /></button>
      <button type="button" className="icon-button" aria-label={`Replace page ${index + 1}`} disabled={disabled} onClick={() => input.current?.click()}><Replace size={16} /></button>
      <button type="button" className="icon-button text-danger" aria-label={`Remove page ${index + 1}`} disabled={disabled} onClick={remove}><Trash2 size={16} /></button>
    </div>
    <label className="alt-field"><span>Alt text</span><input value={page.alt} disabled={disabled} maxLength={400} placeholder="Optional description"
      aria-label={`Alt text for page ${index + 1}`} onChange={(event) => editAlt(event.target.value)} /></label>
    <input type="file" accept=".png,.jpg,.jpeg,.webp" hidden ref={input} aria-label={`Replacement image for page ${index + 1}`} onChange={(event) => {
      const selected = event.target.files?.[0];
      event.target.value = "";
      if (selected) replace(selected);
    }} />
  </li>;
}

export function PagesInput({ pages, setPages, busy, onBusy }: {
  pages: EditablePage[]; setPages: React.Dispatch<React.SetStateAction<EditablePage[]>>;
  busy: boolean; onBusy: (busy: boolean) => void;
}) {
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const [activeDrop, setActiveDrop] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function add(files: File[]) {
    if (!files.length || busy) return;
    setMessage("");
    setProgress(0);
    onBusy(true);
    try {
      await processFiles(files, maxPages - pages.length, async (prepared, index, total) => {
        const page = await uploadArtwork(prepared, (fraction) => setProgress((index + fraction) / total));
        setPages((current) => [...current, { ...page, key: page.asset_id }]);
      });
    } catch (error) { setMessage((error as Error).message); }
    finally { onBusy(false); setProgress(undefined); }
  }

  async function replace(key: string, selected: File) {
    setMessage("");
    setProgress(0);
    onBusy(true);
    try {
      const uploaded = await uploadArtwork(await prepareImage(selected), setProgress);
      setPages((current) => current.map((page) => page.key === key ? { ...uploaded, key } : page));
    } catch (error) { setMessage((error as Error).message); }
    finally { onBusy(false); setProgress(undefined); }
  }

  return <section className="pages-field" aria-labelledby={`${id}-heading`}>
    <div className="split-heading"><h2 id={`${id}-heading`}>Chapter pages</h2><span>{pages.length} / {maxPages}</span></div>
    <div className={`drop-zone ${activeDrop ? "active" : ""}`} onDragOver={(event) => {
      if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); if (!busy) setActiveDrop(true); }
    }} onDragLeave={() => setActiveDrop(false)} onDrop={(event) => {
      if (event.dataTransfer.files.length) {
        event.preventDefault();
        setActiveDrop(false);
        void add(Array.from(event.dataTransfer.files));
      }
    }}>
      <ImagePlus size={26} />
      <p>Drop images or one PDF here.</p>
      <button type="button" className="button secondary" disabled={busy || pages.length >= maxPages} onClick={() => fileInput.current?.click()}>Choose page files</button>
      <small>PNG, JPG, WebP or PDF · 100 MB per source file</small>
      <input hidden ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" multiple aria-label="Chapter page files"
        disabled={busy} onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void add(files);
        }} />
    </div>
    {progress !== undefined && <div className="upload-state" role="status">
      <progress className="upload-progress" value={progress} max="1" aria-label="Chapter upload progress" />
      <span>{Math.round(progress * 100)}% · Preparing and uploading pages</span>
    </div>}
    {message && <p role="alert" className="form-error">{message} Completed pages are kept below.</p>}
    {pages.length > 0 && <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!over || active.id === over.id) return;
      setPages((current) => arrayMove(current, current.findIndex((item) => item.key === active.id),
        current.findIndex((item) => item.key === over.id)));
    }}>
      <SortableContext items={pages.map((page) => page.key)} strategy={rectSortingStrategy}>
        <ol className="edit-pages">{pages.map((page, index) => <SortablePage key={page.key} page={page} index={index} length={pages.length}
          disabled={busy} move={(delta) => setPages((current) => arrayMove(current, index, index + delta))}
          remove={() => setPages((current) => current.filter((item) => item.key !== page.key))}
          replace={(file) => void replace(page.key, file)} editAlt={(alt) => setPages((current) => current.map((item) =>
            item.key === page.key ? { ...item, alt } : item))} />)}</ol>
      </SortableContext>
    </DndContext>}
  </section>;
}
