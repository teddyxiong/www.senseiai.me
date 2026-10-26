export type AccountMenuConfig = {
  buttons: {
    signIn: string;
  };
  menu: {
    planAndBilling: string;
    signOut: string;
  };
  links: {
    login: string;
    billing: string;
  };
  a11y?: {
    accountMenu?: string;
  };
};

export type MeUser = {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  image?: string | null;
};

export type MeResponseAuthed = {
  authenticated: true;
  user: MeUser;
  sessionExpiresAt?: string;
};

export type MeResponseUnAuthed = {
  authenticated: false;
};

export type MeResponse = MeResponseAuthed | MeResponseUnAuthed;

export type MeCache = {
  ts: number;
  authenticated: boolean;
  user?: MeUser;
  sessionExpiresAt?: string;
};

export type ViewState = "unknown" | "signedOut" | "signedIn" | "error";

export const isAuthedMeResponse = (value: unknown): value is MeResponseAuthed => {
  if (!value || typeof value !== "object") return false;
  const resp = value as Partial<MeResponseAuthed>;
  if (resp.authenticated !== true) return false;
  if (!resp.user || typeof resp.user.id !== "string" || typeof resp.user.email !== "string") {
    return false;
  }
  return resp.sessionExpiresAt === undefined || (
    typeof resp.sessionExpiresAt === "string" &&
    Number.isFinite(Date.parse(resp.sessionExpiresAt))
  );
};
