import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FALLBACK_AVATAR_URL } from "@/lib/account/constants";
import { buildSignInUrl, signOutAndReturn } from "@/lib/account/authFlow";
import { maybeRunOneTap } from "@/lib/account/oneTap";
import {
  clearMeCache,
  hasDevAuthOverride,
  isMeCacheFresh,
  readMeCache,
  revalidateMe,
} from "@/lib/account/session";
import type { AccountMenuConfig, MeUser, ViewState } from "@/lib/account/types";

type LocationSnapshot = { pathname: string; search: string; hash: string };

const buildNext = ({ pathname, search, hash }: LocationSnapshot) =>
  `${pathname}${search}${hash}`;

const AccountAvatar = ({ src }: { src: string }) => (
  <img
    src={src}
    alt=""
    className="h-4 w-4 rounded-full object-cover"
    loading="lazy"
    decoding="async"
    referrerPolicy="no-referrer"
  />
);

const AccountNav = ({ menuConfig }: { menuConfig: AccountMenuConfig }) => {
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot>(
    () => {
      if (typeof window === "undefined")
        return { pathname: "/", search: "", hash: "" };
      return {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      };
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const nextLocation = {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      };
      setLocationSnapshot((prev) => {
        if (
          prev.pathname === nextLocation.pathname &&
          prev.search === nextLocation.search &&
          prev.hash === nextLocation.hash
        ) {
          return prev;
        }
        return nextLocation;
      });
    };
    update();
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    document.addEventListener("astro:after-swap", update);
    document.addEventListener("astro:page-load", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      document.removeEventListener("astro:after-swap", update);
      document.removeEventListener("astro:page-load", update);
    };
  }, []);

  const pathname = locationSnapshot.pathname;
  const next = useMemo(() => buildNext(locationSnapshot), [locationSnapshot]);

  const [viewState, setViewState] = useState<ViewState>("unknown");
  const [user, setUser] = useState<MeUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const hasHydratedStateRef = useRef(false);
  const didHydrateSessionRef = useRef(false);

  const applySignedOut = useCallback(() => {
    hasHydratedStateRef.current = true;
    setUser(null);
    setViewState("signedOut");
  }, []);

  const applySignedIn = useCallback((nextUser: MeUser) => {
    hasHydratedStateRef.current = true;
    setUser(nextUser);
    setViewState("signedIn");
  }, []);

  const doRevalidate = useCallback(async () => {
    const result = await revalidateMe();

    if (result.kind === "signedIn") {
      applySignedIn(result.data.user);
      return;
    }

    if (result.kind === "signedOut") {
      applySignedOut();
      maybeRunOneTap(pathname);
      return;
    }

    if (!hasHydratedStateRef.current) {
      setViewState("error");
    }
  }, [applySignedIn, applySignedOut, pathname]);

  useEffect(() => {
    if (didHydrateSessionRef.current) return;
    didHydrateSessionRef.current = true;

    const cached = readMeCache();
    if (cached) {
      if (cached.authenticated && cached.user) applySignedIn(cached.user);
      else applySignedOut();
    }

    if (hasDevAuthOverride()) {
      void doRevalidate();
      return;
    }
    if (cached?.authenticated && isMeCacheFresh(cached, Date.now())) return;
    void doRevalidate();
  }, [applySignedIn, applySignedOut, doRevalidate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      const cached = readMeCache();
      const now = Date.now();
      if (cached && isMeCacheFresh(cached, now)) return;
      void doRevalidate();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [doRevalidate]);

  const onSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    const result = await signOutAndReturn();
    if (result.kind === "unavailable") {
      setSigningOut(false);
    }
  }, [signingOut]);

  if (viewState === "unknown" || viewState === "error") {
    return <div className="h-[38px] w-[88px]" aria-hidden="true" />;
  }

  if (viewState === "signedIn" && user) {
    return (
      <div className="group relative">
        <button
          type="button"
          className="inline-flex h-[35px] items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-sm font-semibold text-primary transition hover:border-primary hover:text-primary"
          aria-label={menuConfig.a11y?.accountMenu || "Account menu"}
          aria-haspopup="menu"
        >
          <AccountAvatar src={user.image || FALLBACK_AVATAR_URL} />
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div
          className="account-dropdown-panel invisible absolute right-0 z-50 mt-2 flex min-w-[120px] translate-y-2 flex-col opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
          role="menu"
        >
          <a
            href={menuConfig.links.billing}
            className="menu-dropdown-link"
            role="menuitem"
          >
            {menuConfig.menu.planAndBilling}
          </a>
          <button
            type="button"
            className="menu-dropdown-link w-full text-left disabled:opacity-60"
            onClick={onSignOut}
            disabled={signingOut}
            role="menuitem"
          >
            {menuConfig.menu.signOut}
          </button>
        </div>
      </div>
    );
  }

  const signInHref = buildSignInUrl(next);

  return (
    <div className="flex items-center gap-2">
      <a
        href={signInHref}
        data-astro-reload
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          clearMeCache();
        }}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-bold text-primary transition hover:border-primary hover:text-primary"
      >
        {menuConfig.buttons.signIn}
      </a>
    </div>
  );
};

export default AccountNav;
