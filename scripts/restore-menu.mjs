import { existsSync } from "node:fs";
import { copyFile, rm } from "node:fs/promises";

function restorable(bakPath, label) {
  if (!existsSync(bakPath)) {
    console.log(`[postbuild] ${label} no backup found, skip restore`);
    return false;
  }
  return true;
}

const MENU_BAK_PATH = "src/config/menu.json.bak";
const MENU_PATH = "src/config/menu.json";

if (restorable(MENU_BAK_PATH, "menu.json")) {
  await copyFile(MENU_BAK_PATH, MENU_PATH);
  await rm(MENU_BAK_PATH);
  console.log("[postbuild] menu.json: restored from backup");
}

const CONFIG_BAK_PATH = "src/config/config.json.bak";
const CONFIG_PATH = "src/config/config.json";

if (restorable(CONFIG_BAK_PATH, "config.json")) {
  await copyFile(CONFIG_BAK_PATH, CONFIG_PATH);
  await rm(CONFIG_BAK_PATH);
  console.log("[postbuild] config.json: restored from backup");
}