"use client";

import type { PageArt } from "./types";
import { artworkSpecs, type Artwork, type ArtworkKind, type ArtworkVariant, type Crop } from "./artwork";

export const maxPages = 250;
const maxSourceSize = 100 * 1024 * 1024;
const maximumWebP = 7_900_000;
const natural = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export const validImage = (file: File) => /\.(png|jpe?g|webp)$/i.test(file.name);
export const isPdf = (file: File) => /\.pdf$/i.test(file.name);

export async function adminRequest<T = { ok: boolean }>(payload: object): Promise<T> {
  const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || "The request failed. Try again.");
  return result as T;
}

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = Math.max(1, Math.round(width));
  element.height = Math.max(1, Math.round(height));
  return element;
}

function webp(element: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => element.toBlob((blob) => {
    if (blob?.type === "image/webp") resolve(blob);
    else reject(new Error("This browser could not encode WebP. Try an up-to-date browser."));
  }, "image/webp", quality));
}

function drawResized(source: CanvasImageSource, width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const target = canvas(width * scale, height * scale);
  const context = target.getContext("2d", { alpha: false })!;
  context.fillStyle = "white";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

export const defaultCrop: Crop = { zoom: 1, x: 50, y: 50 };

export function coverFrame(image: ImageBitmap, crop: Crop, kind: ArtworkKind = "cover") {
  const specification = artworkSpecs[kind];
  const ratio = specification.width / specification.height;
  const width = Math.min(image.width, image.height * ratio) / crop.zoom;
  const height = width / ratio;
  const x = (image.width - width) * crop.x / 100;
  const y = (image.height - height) * crop.y / 100;
  return { width, height, x, y, ratio };
}

export function drawCover(target: HTMLCanvasElement, image: ImageBitmap, crop: Crop, kind: ArtworkKind = "cover") {
  const { width, height, x, y } = coverFrame(image, crop, kind);
  const context = target.getContext("2d", { alpha: false })!;
  context.fillStyle = "white";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, x, y, width, height, 0, 0, target.width, target.height);
}

type Prepared = { full: Blob; thumb: Blob; width: number; height: number; filename: string };
type PreparedCover = Omit<Prepared, "thumb"> & { artwork: Artwork; reused?: string; thumb?: Blob; card?: Blob; master?: Blob };

async function prepareArtwork(full: HTMLCanvasElement, thumbnail: HTMLCanvasElement, filename: string): Promise<Prepared> {
  let fullBlob = await webp(full, .93);
  if (fullBlob.size > maximumWebP) fullBlob = await webp(full, .87);
  if (fullBlob.size > maximumWebP) throw new Error("This page is too large after compression.");
  return { full: fullBlob, thumb: await webp(thumbnail, .8),
    width: full.width, height: full.height, filename: Array.from(filename).slice(0, 200).join("") };
}

export async function prepareCover(image: ImageBitmap, crop: Crop, filename: string, kind: ArtworkKind, reused?: string): Promise<PreparedCover> {
  const frame = coverFrame(image, crop, kind);
  const render = (limit: number) => {
    const width = Math.max(1, Math.floor(Math.min(frame.width, limit)));
    const result = canvas(width, width / frame.ratio);
    drawCover(result, image, crop, kind);
    return result;
  };
  const fullFrame = render(artworkSpecs[kind].width);
  const full = await webp(fullFrame, .92);
  const thumbWidth = Math.min(400, fullFrame.width);
  const thumb = thumbWidth < fullFrame.width ? await webp(render(thumbWidth), .9) : undefined;
  const cardWidth = kind === "hero" ? 1080 : 800;
  const card = fullFrame.width > cardWidth ? await webp(render(cardWidth), .92) : undefined;
  // The master is an uncropped WebP. Later crops reuse it by asset ID.
  const master = reused ? undefined : await webp(drawResized(image, image.width, image.height, 3600, 3600), .96);
  const files = [full, ...(thumb ? [thumb] : []), ...(card ? [card] : []), ...(master ? [master] : [])];
  if (files.some((file) => file.size > maximumWebP)) throw new Error("This artwork exceeds the storage limit. Choose a smaller source file.");
  const bytes = files.reduce((total, file) => total + file.size, 0);
  return { full, thumb, card, master, width: fullFrame.width, height: fullFrame.height, filename, reused,
    artwork: { kind, sourceWidth: image.width, sourceHeight: image.height, width: fullFrame.width, height: fullFrame.height,
      thumb: thumbWidth, ...(card ? { card: cardWidth } : {}), blur: render(20).toDataURL("image/webp", .66), crop, bytes } };
}

export async function decodeImage(file: File) {
  if (!validImage(file)) throw new Error("Choose a PNG, JPG, or WebP image.");
  if (file.size > maxSourceSize) throw new Error("Each source file must be 100 MB or smaller.");
  try { return await createImageBitmap(file); }
  catch { throw new Error(`Could not open “${file.name}”. Check the image format.`); }
}

export async function prepareImage(file: File) {
  const image = await decodeImage(file);
  try {
    return await prepareArtwork(drawResized(image, image.width, image.height, 2200, 6000),
      drawResized(image, image.width, image.height, 400, 950), file.name);
  } finally { image.close(); }
}

export async function processFiles(files: File[], available: number,
  consume: (page: Prepared, index: number, total: number) => Promise<void>) {
  if (!files.length) return;
  if (files.length === 1 && isPdf(files[0])) {
    if (files[0].size > maxSourceSize) throw new Error("The source PDF must be 100 MB or smaller.");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({
      data: new Uint8Array(await files[0].arrayBuffer()),
      cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/", isEvalSupported: false,
    });
    task.onPassword = () => { void task.destroy().catch(() => {}); };
    try {
      const document = await task.promise;
      if (document.numPages > available) throw new Error(`Only ${available} more pages fit in this chapter.`);
      for (let index = 1; index <= document.numPages; index++) {
        const page = await document.getPage(index);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2200 / original.width, 6000 / original.height) });
        const rendered = canvas(viewport.width, viewport.height);
        await page.render({ canvas: rendered, viewport }).promise;
        const thumb = drawResized(rendered, rendered.width, rendered.height, 400, 950);
        await consume(await prepareArtwork(rendered, thumb, `page-${String(index).padStart(3, "0")}.webp`),
          index - 1, document.numPages);
        rendered.width = 1;
        page.cleanup();
      }
    } catch (error) {
      if (error instanceof Error && /password|destroyed/i.test(error.message)) {
        throw new Error("Open or unlock the PDF before uploading it.");
      }
      throw error;
    } finally { await task.destroy().catch(() => {}); }
    return;
  }
  if (files.length > available) throw new Error(`Only ${available} more pages fit in this chapter.`);
  if (files.some((file) => !validImage(file))) throw new Error("Choose images together, or one PDF.");
  const sorted = [...files].sort((a, b) => natural.compare(a.name, b.name));
  for (const [index, file] of sorted.entries()) await consume(await prepareImage(file), index, sorted.length);
}

function transfer(url: string, blob: Blob, name: string, progress: (part: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.timeout = 120000;
    request.upload.onprogress = (event) => { if (event.lengthComputable) progress(event.loaded / event.total); };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { progress(1); resolve(); }
      else reject(new Error(`Storage rejected the upload (HTTP ${request.status}).`));
    };
    request.onerror = () => reject(new Error("Could not reach storage. Check your connection and try again."));
    request.ontimeout = () => reject(new Error("The storage upload timed out. Try again."));
    const body = new FormData();
    body.append("cacheControl", "600");
    body.append("", blob, name);
    request.send(body);
  });
}

export async function uploadArtwork(image: Prepared | PreparedCover, onProgress: (fraction: number) => void): Promise<PageArt> {
  const cover = "artwork" in image ? image : undefined;
  const signed = await adminRequest<{ id: string } & Partial<Record<ArtworkVariant, string>>>(cover
    ? { action: "upload-cover", artwork: cover.artwork, reuse: cover.reused ?? null } : { action: "upload" });
  const files: [ArtworkVariant, Blob][] = [["full", image.full]];
  if (image.thumb) files.push(["thumb", image.thumb]);
  if (cover?.card) files.push(["card", cover.card]);
  if (cover?.master) files.push(["master", cover.master]);
  const output = files.map(() => 0);
  const total = files.reduce((sum, [, blob]) => sum + blob.size, 0);
  const track = (index: number) => (fraction: number) => {
    output[index] = files[index][1].size * fraction;
    onProgress(output.reduce((sum, bytes) => sum + bytes, 0) / total);
  };
  // Let both transfers settle, so retrying cannot overlap an unfinished upload.
  const results = await Promise.allSettled(files.map(async ([variant, blob], index) => {
    const url = signed[variant];
    if (!url) throw new Error("Could not sign the artwork upload.");
    await transfer(url, blob, `${variant}.webp`, track(index));
  }));
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return { asset_id: signed.id, width: image.width, height: image.height, filename: image.filename, alt: "" };
}
