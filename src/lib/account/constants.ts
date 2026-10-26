import config from "@/config/config.json";

export const API_ORIGIN = config.site.base_url.replace(/\/$/, "");
export const ASSET_ORIGIN = config.site.asset_base_url.replace(/\/$/, "");

export const ME_URL = `${API_ORIGIN}/api/me`;
export const CHECKOUT_URL = `${API_ORIGIN}/api/billing/checkout`;
export const PAYPAL_CAPTURE_URL = `${CHECKOUT_URL}/paypal/capture`;
export const CUSTOMER_PORTAL_URL = `${API_ORIGIN}/api/billing/customer-portal`;
export const SIGN_IN_URL = `${API_ORIGIN}/auth/sign-in`;
export const SIGN_OUT_URL = `${API_ORIGIN}/api/auth/sign-out`;
export const DEFAULT_AFTER_AUTH = "/dashboard/";
export const MAX_NEXT_LENGTH = 2048;

export const ME_CACHE_KEY = "account.me.v1";
export const ME_CACHE_TTL_MS = 60_000;
export const ME_EXPIRES_EARLY_MS = 1_000;

export const ME_IN_FLIGHT_MAX_AGE_MS = 5_000;
export const ME_FAIL_COOLDOWN_MS = 30_000;

export const AUTH_PATH_PREFIX = "/auth/";
export const ONE_TAP_MODULE_URL = "/auth/one-tap.js";
export const ONE_TAP_MIN_INTERVAL_MS = 3_000;

export const FALLBACK_AVATAR_URL = `${ASSET_ORIGIN}/images/favicon.png`;

export const DEV_AUTH_STORAGE_KEY = "account.dev.authenticated";
export const DEV_USER_STORAGE_KEY = "account.dev.user";
