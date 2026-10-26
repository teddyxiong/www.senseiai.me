import {
  AUTH_PATH_PREFIX,
  ONE_TAP_MIN_INTERVAL_MS,
  ONE_TAP_MODULE_URL,
} from "@/lib/account/constants";

export const shouldTriggerOneTap = (pathname: string) => !pathname.startsWith(AUTH_PATH_PREFIX);

let lastTriggerTs = 0;
let oneTapInFlight: Promise<void> | null = null;

export const maybeRunOneTap = (pathname: string) => {
  if (!shouldTriggerOneTap(pathname)) return;

  const now = Date.now();
  if (now - lastTriggerTs < ONE_TAP_MIN_INTERVAL_MS) return;

  lastTriggerTs = now;

  if (oneTapInFlight) return;

  oneTapInFlight = import(/* @vite-ignore */ ONE_TAP_MODULE_URL)
    .then((m: unknown) => {
      const mod = m as { runOneTap?: () => void };
      mod.runOneTap?.();
    })
    .catch(() => {
      /* one-tap 失败时忽略 */
    })
    .finally(() => {
      oneTapInFlight = null;
    });
};
