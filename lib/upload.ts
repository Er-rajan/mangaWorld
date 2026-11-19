"use client";

import type { PageArt } from "./types";

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

export type Crop = { zoom: number; x: number; y: number };
export const defaultCrop: Crop = { zoom: 1, x: 50, y: 50 };

export function drawCover(target: HTMLCanvasElement, image: ImageBitmap, crop: Crop) {
  const ratio = 2 / 3;
  const width = Math.min(image.width, image.height * ratio) / crop.zoom;
  const height = width / ratio;
  const x = (image.width - width) * crop.x / 100;
  const y = (image.height - height) * crop.y / 100;
  const context = target.getContext("2d", { alpha: false })!;
  context.fillStyle = "white";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, x, y, width, height, 0, 0, target.width, target.height);
}

type Prepared = { full: Blob; thumb: Blob; width: number; height: number; filename: string };

async function prepareArtwork(full: HTMLCanvasElement, thumbnail: HTMLCanvasElement, filename: string): Promise<Prepared> {
  let fullBlob = await webp(full, .87);
  if (fullBlob.size > maximumWebP) fullBlob = await webp(full, .73);
  if (fullBlob.size > maximumWebP) throw new Error("This page is too large after compression.");
  return { full: fullBlob, thumb: await webp(thumbnail, .8),
    width: full.width, height: full.height, filename: Array.from(filename).slice(0, 200).join("") };
}

export async function prepareCover(image: ImageBitmap, crop: Crop, filename: string) {
  const full = canvas(1000, 1500);
  const thumb = canvas(400, 600);
  drawCover(full, image, crop);
  drawCover(thumb, image, crop);
  return prepareArtwork(full, thumb, filename);
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
    return await prepareArtwork(drawResized(image, image.width, image.height, 1900, 4800),
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
        const viewport = page.getViewport({ scale: Math.min(1900 / original.width, 4200 / original.height) });
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

export async function uploadArtwork(image: Prepared, onProgress: (fraction: number) => void): Promise<PageArt> {
  const { id, full, thumb } = await adminRequest<{ id: string; full: string; thumb: string }>({ action: "upload" });
  const output = [0, 0];
  const sizes = [image.full.size, image.thumb.size];
  const track = (index: number) => (fraction: number) => {
    output[index] = sizes[index] * fraction;
    onProgress((output[0] + output[1]) / (sizes[0] + sizes[1]));
  };
  // Let both transfers settle, so retrying cannot overlap an unfinished upload.
  const results = await Promise.allSettled([
    transfer(full, image.full, "full.webp", track(0)), transfer(thumb, image.thumb, "thumb.webp", track(1)),
  ]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return { asset_id: id, width: image.width, height: image.height, filename: image.filename, alt: "" };
}
