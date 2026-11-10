import { getDownloadUrl } from "../api/endpoints/content";

/**
 * Downloads a resource through the API's download endpoint (short-lived signed URL).
 * Same-origin URLs are fetched and saved as a file; storage URLs (real backend) are opened directly,
 * and the storage host sends "Content-Disposition: attachment".
 */
export async function downloadResource(id: string, fallbackName: string): Promise<void> {
  const { url } = await getDownloadUrl(id);
  const target = new URL(url, window.location.origin);
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href);
    return;
  }
  const res = await fetch(target.href, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
