import { createHash } from "node:crypto";

// Backblaze B2 native API: a few fetch calls, no SDK. The bucket is PRIVATE: files are read back only through /f/…,
// which checks the signed-in user (app/f/[...path]/route.ts).
export const b2Enabled = () => !!(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET_ID && process.env.B2_BUCKET_NAME);

async function b2<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`B2 ${res.status}: ${await res.text()}`);
  return res.json();
}

// shortcut: re-authorizes on every call, fine at receipt/screenshot volume. Upgrade: cache the account token (valid 24 h).
const authorize = () =>
  b2<{ authorizationToken: string; apiInfo: { storageApi: { apiUrl: string; downloadUrl: string } } }>(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    { headers: { Authorization: "Basic " + Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString("base64") } },
  );

const encodePath = (fileName: string) => fileName.split("/").map(encodeURIComponent).join("/");

/** Uploads a file and returns its B2 link. The link alone doesn't open (private bucket): show it with fileHref(). */
export async function uploadPublic(fileName: string, body: Buffer, contentType: string) {
  const account = await authorize();
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

/** Reads a private file. Caller must have checked the user may see it. */
export async function downloadPrivate(fileName: string) {
  const account = await authorize();
  return fetch(`${account.apiInfo.storageApi.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${encodePath(fileName)}`, {
    headers: { Authorization: account.authorizationToken },
  });
}

/** File path inside the bucket from a stored B2 link (older links may carry a wrong bucket name). */
export const b2Path = (url: string) => url.match(/^https:\/\/[^/]+\.backblazeb2\.com\/file\/[^/]+\/(.+)$/)?.[1];

/** Link to show in the app: B2 files go through the signed-in /f/ route; other links (e.g. /r/{id}/pdf) stay as they are. */
export const fileHref = (url: string) => {
  const path = b2Path(url);
  return path ? `/f/${encodePath(path)}` : url;
};
