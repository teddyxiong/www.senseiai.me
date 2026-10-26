import { triggerAutoDownloadIfRequested } from './autoDownload';

// Whitelisted paths where auto-download may trigger
const WHITELIST: RegExp[] = [
  /^\/$/,              // homepage
  /^\/downloads\/?$/  // downloads page
];

function shouldTriggerOncePerPath(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('download')) return false;
  const path = window.location.pathname;
  const allowed = WHITELIST.some((re) => re.test(path));
  if (!allowed) return false;

  const key = `lj_auto_download_once:${path}`;
  if (sessionStorage.getItem(key) === '1') return false;
  sessionStorage.setItem(key, '1');
  return true;
}

const runAutoDownload = async () => {
  try {
    if (!shouldTriggerOncePerPath()) return;
    await triggerAutoDownloadIfRequested();
  } catch {}
};

window.addEventListener('DOMContentLoaded', runAutoDownload);
// Support Astro view transitions
document.addEventListener('astro:after-swap', runAutoDownload);