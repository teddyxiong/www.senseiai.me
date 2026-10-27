export type OsType = "windows" | "mac" | "other";
export type MacArch = "intel" | "arm" | "unknown";

const WINDOWS_URL = "https://www.senseiai.me/download/SenseiAI_x64-setup.exe";
const MAC_INTEL_URL = "https://www.senseiai.me/download/SenseiAI_x64.dmg";
const MAC_ARM_URL = "https://www.senseiai.me/download/SenseiAI_aarch64.dmg";

export function detectOS(): OsType {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  if (ua.includes("windows") || platform.startsWith("win")) return "windows";
  if (ua.includes("mac") || platform.includes("mac")) return "mac";
  return "other";
}

export async function detectMacArch(): Promise<MacArch> {
  try {
    const uaData: any = (navigator as any).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === "function") {
      const values = await uaData.getHighEntropyValues(["architecture", "platform"]);
      const arch = (values.architecture || "").toLowerCase();
      if (arch.includes("arm")) return "arm";
      if (arch.includes("x86") || arch.includes("amd") || arch.includes("ia")) return "intel";
    }
  } catch {}

  const ua = navigator.userAgent;
  if (/Intel Mac OS X/i.test(ua)) return "intel";
  if (/Mac OS X/i.test(ua) && !/Intel/i.test(ua)) return "arm";
  return "unknown";
}

export async function computeDownloadUrl(): Promise<string | null> {
  const os = detectOS();
  if (os === "windows") return WINDOWS_URL;
  if (os === "mac") {
    const arch = await detectMacArch();
    if (arch === "intel") return MAC_INTEL_URL;
    return MAC_ARM_URL;
  }
  return null;
}

export async function triggerAutoDownloadIfRequested(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("download")) return;
  const url = await computeDownloadUrl();
  if (!url) return;
  window.location.assign(url);
}