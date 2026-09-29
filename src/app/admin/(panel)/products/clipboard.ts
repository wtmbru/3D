"use client";

/*
 * Getting photos in from the clipboard: a screenshot, "Copy image" from a
 * web page, or a picture copied from Preview / Photos / Files.
 */

/** Image types the photo bucket accepts, and the file extension we name them with. */
const PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface PastedImages {
  /** Supported images, named and ready to upload. */
  files: File[];
  /** Images on the clipboard we can't use (GIF, HEIC, SVG…). */
  skipped: number;
}

/** A clipboard image has no useful name ("image.png"), so give it a unique one. */
function toPhotoFile(blob: Blob, index: number): File | null {
  const ext = PHOTO_TYPES[blob.type];
  if (!ext) return null;
  return new File([blob], `pasted-photo-${Date.now()}-${index}.${ext}`, { type: blob.type });
}

function collect(blobs: Blob[]): PastedImages {
  const files: File[] = [];
  let skipped = 0;
  for (const blob of blobs) {
    const file = toPhotoFile(blob, files.length);
    if (file) files.push(file);
    else skipped++;
  }
  return { files, skipped };
}

/** Images from a paste event (Cmd/Ctrl+V). */
export function imagesFromPaste(data: DataTransfer | null): PastedImages {
  const blobs: Blob[] = [];
  for (const item of Array.from(data?.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) blobs.push(file);
    }
  }
  return collect(blobs);
}

/**
 * True when the paste should be left to the page: she's typing in a text box
 * and the clipboard has text (apps like Word or Excel put a picture of the
 * cells on the clipboard too, and that must not hijack a normal text paste).
 */
export function isPlainTextPaste(e: ClipboardEvent): boolean {
  const el = e.target instanceof HTMLElement ? e.target : null;
  const typing =
    !!el &&
    (el.isContentEditable ||
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes(el.type)));
  return typing && !!e.clipboardData?.getData("text/plain");
}

/** Images from the clipboard via the button (asks the browser for permission). */
export async function readClipboardImages(): Promise<PastedImages> {
  if (!navigator.clipboard?.read) {
    throw new Error("This browser can't read the clipboard from a button. Press ⌘V (Ctrl+V) on the page instead.");
  }
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch {
    throw new Error("The browser didn't allow clipboard access. Press ⌘V (Ctrl+V) on the page instead.");
  }
  const blobs: Blob[] = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) blobs.push(await item.getType(type));
  }
  return collect(blobs);
}
