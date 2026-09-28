"use client";

import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { createUploadUrl } from "../../actions";

export interface StlInfo {
  triangles: number;
  /** Bounding box size in mm (x, y, z as exported). */
  size: [number, number, number];
}

/** Parse the STL locally so broken files are caught before uploading. */
export async function inspectStl(file: File): Promise<StlInfo> {
  const geo = new STLLoader().parse(await file.arrayBuffer());
  const triangles = (geo.getAttribute("position")?.count ?? 0) / 3;
  if (!triangles) throw new Error(`${file.name} doesn't contain any triangles. Is it a valid STL?`);
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size: StlInfo["size"] = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
  geo.dispose();
  return { triangles, size };
}

const contentTypes: Record<string, string> = {
  stl: "model/stl",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Upload straight from the browser to Supabase Storage using a signed URL
 * from the server. Uses XHR (not fetch) for upload progress on big models.
 */
export async function uploadFile(
  productId: string,
  kind: "model" | "photo",
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const res = await createUploadUrl({ productId, kind, filename: file.name, size: file.size });
  if (!res.ok) throw new Error(res.error);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const body = new FormData();
  body.append("cacheControl", "31536000"); // files are never overwritten, so cache forever
  body.append("", new Blob([file], { type: contentTypes[ext] ?? file.type }), file.name);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", res.signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(body);
  });
  return res.publicUrl;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** "left_eye.stl" → "Left eye" */
export function nameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Part";
}
