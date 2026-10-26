import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });

const rcloneAvailable = (() => {
  try {
    execSync("command -v rclone", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

if (!rcloneAvailable) {
  console.log("[sync-public] rclone not found, skipping sync");
  process.exit(0);
}

try {
  const answer = await rl.question(
    "[sync-public] Perform file diff check? (y/N) "
  );
  if (answer.trim().toLowerCase() !== "y") {
    console.log("[sync-public] Diff check skipped by user, sync aborted");
    process.exit(0);
  }
} finally {
  rl.close();
}

console.log("[sync-public] checking for new/changed files in public/ ...");

try {
  const diffOutput = execSync(
    'rclone copy ./public r2:public --config ./rclone.conf --checksum --dry-run --verbose --metadata-set cache-control=public,max-age=31536000,immutable --exclude "**/.DS_Store" --exclude ".DS_Store" 2>&1',
    { encoding: "utf-8", timeout: 30000 }
  );

  const files = new Set();
  const markers = [
    ": Skipped copy as --dry-run is set",
    ": Copied (new)",
    ": Copied (replaced existing)",
    ": Copied",
  ];

  for (const rawLine of diffOutput.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.includes("There was nothing to transfer")) continue;

    const noticeIndex = line.indexOf("NOTICE:");
    if (noticeIndex === -1) continue;

    const afterNotice = line.slice(noticeIndex + "NOTICE:".length).trim();
    if (!afterNotice) continue;

    let markerIndex = -1;
    for (const marker of markers) {
      const idx = afterNotice.indexOf(marker);
      if (idx === -1) continue;
      if (markerIndex === -1 || idx < markerIndex) markerIndex = idx;
    }
    if (markerIndex === -1) continue;

    const filePath = afterNotice.slice(0, markerIndex).trim();
    if (!filePath) continue;
    files.add(filePath);
  }

  if (files.size > 0) {
    console.log("[sync-public] Files to upload:");
    for (const filePath of [...files].sort()) {
      console.log(`  ${filePath}`);
    }
    console.log(`[sync-public] Total: ${files.size} file(s)`);
  } else {
    console.log("[sync-public] No new or changed files detected, sync skipped");
    process.exit(0);
  }
} catch (err) {
  console.log(
    "[sync-public] Diff check failed, sync skipped:",
    err.message
  );
  process.exit(0);
}

const rl2 = createInterface({ input: process.stdin, output: process.stdout });

try {
  const answer = await rl2.question(
    "[sync-public] Upload these files to R2? (y/N) "
  );
  if (answer.trim().toLowerCase() !== "y") {
    console.log("[sync-public] Upload skipped by user");
    process.exit(0);
  }

  console.log("[sync-public] syncing...");
  execSync(
    'rclone copy ./public r2:public --config ./rclone.conf --checksum --verbose --metadata-set cache-control=public,max-age=31536000,immutable --exclude "**/.DS_Store" --exclude ".DS_Store"',
    { stdio: "inherit" }
  );
  console.log("[sync-public] done");
} catch (err) {
  console.log("[sync-public] sync failed, continuing anyway:", err.message);
} finally {
  rl2.close();
}
