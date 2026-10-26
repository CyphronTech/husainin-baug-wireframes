import { createHash } from "node:crypto";

// Backblaze B2 native API: three fetch calls, no SDK.
export const b2Enabled = () => !!(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET_ID && process.env.B2_BUCKET_NAME);

async function b2<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`B2 ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Uploads to a PUBLIC bucket and returns the file's public URL. */
// shortcut: public bucket — anyone with the link can open the file; the link holds the random booking doc id, so it
// can't be guessed (same protection the app's /r/{id} page has). Re-authorizes on every upload (3 calls), fine at
// receipt volume. Upgrade: private bucket + b2_get_download_authorization, cache the account token.
export async function uploadPublic(fileName: string, body: Buffer, contentType: string) {
  const account = await b2<{ authorizationToken: string; apiInfo: { storageApi: { apiUrl: string; downloadUrl: string } } }>(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    { headers: { Authorization: "Basic " + Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString("base64") } },
  );
  const { apiUrl, downloadUrl } = account.apiInfo.storageApi;
  const upload = await b2<{ uploadUrl: string; authorizationToken: string }>(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: account.authorizationToken },
    body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
  });
  await b2(upload.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: upload.authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(fileName),
      "Content-Type": contentType,
      "X-Bz-Content-Sha1": createHash("sha1").update(body).digest("hex"), // integrity checksum B2 requires, not encryption
    },
    body: new Uint8Array(body),
  });
  return `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
}
