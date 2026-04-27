/**
 * Quick smoke test for Drive integration.
 * Run with:  npx tsx scripts/test-drive.ts
 */
import "dotenv/config";
import { getDriveClient } from "@/lib/google/drive";

async function main() {
  const drive = getDriveClient();
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set");
  }

  // 1) About me
  const about = await drive.about.get({ fields: "user" });
  console.log("Authenticated as:", about.data.user?.emailAddress);

  // 2) List children of the root folder
  const children = await drive.files.list({
    q: `'${rootId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  console.log(`\nRoot folder children (${children.data.files?.length ?? 0}):`);
  for (const f of children.data.files ?? []) {
    console.log(`  - ${f.name}  [${f.mimeType}]  id=${f.id}`);
  }

  // 3) If a 雛形 folder exists, list its contents too
  const template = (children.data.files ?? []).find((f) => f.name === "雛形");
  if (template?.id) {
    console.log(`\n雛形 folder children:`);
    const sub = await drive.files.list({
      q: `'${template.id}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, size)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of sub.data.files ?? []) {
      console.log(
        `  - ${f.name}  [${f.mimeType}]  size=${f.size ?? "?"}  id=${f.id}`,
      );
    }
  } else {
    console.log("\n（雛形フォルダが見つかりませんでした）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
