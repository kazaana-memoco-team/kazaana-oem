/**
 * Google Drive client backed by a service account.
 *
 * Setup:
 *   1. Place the service-account JSON at `.secrets/google-service-account.json`
 *      (gitignored). For production, set the JSON contents in the
 *      GOOGLE_SERVICE_ACCOUNT_JSON env var instead.
 *   2. Share the destination Drive folder with the service-account email
 *      (becos-oem-drive-approad@becosoem.iam.gserviceaccount.com) as Editor.
 *   3. Set GOOGLE_DRIVE_ROOT_FOLDER_ID to the shared folder ID.
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { JWT } from "google-auth-library";

let cached: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;

  const credentials = loadCredentials();
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  cached = google.drive({ version: "v3", auth });
  return cached;
}

function loadCredentials(): { client_email: string; private_key: string } {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson);
    } catch (e) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON is set but not valid JSON: ${(e as Error).message}`,
      );
    }
  }

  const filePath = path.join(
    process.cwd(),
    ".secrets",
    "google-service-account.json",
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Google service account credentials not found. Place the JSON at ${filePath} or set GOOGLE_SERVICE_ACCOUNT_JSON env var.`,
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Find a child folder by name within a parent folder.
 * Returns null if not found.
 */
export async function findFolderByName(
  parentId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const drive = getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const file = res.data.files?.[0];
  if (!file?.id) return null;
  return { id: file.id, name: file.name ?? name };
}

/**
 * Upload a file (Buffer or string) to a Drive folder.
 * Returns the uploaded file's metadata.
 */
export async function uploadFileToFolder(args: {
  parentId: string;
  fileName: string;
  mimeType: string;
  content: Buffer | string;
}): Promise<{ id: string; webViewLink: string | null }> {
  const drive = getDriveClient();
  const body =
    typeof args.content === "string"
      ? Readable.from([args.content])
      : Readable.from(args.content);

  const res = await drive.files.create({
    requestBody: {
      name: args.fileName,
      parents: [args.parentId],
      mimeType: args.mimeType,
    },
    media: {
      mimeType: args.mimeType,
      body,
    },
    fields: "id, webViewLink, webContentLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id ?? "",
    webViewLink: res.data.webViewLink ?? null,
  };
}
