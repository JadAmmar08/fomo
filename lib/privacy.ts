export const BLOCKED_DOMAINS = [
  "usefomo.net",
  "usefomo.co",
  "fomo-kappa-eight.vercel.app",
  "localhost"
];

export const SENSITIVE_DOMAIN_PATTERNS = [
  "bank",
  "chase.com",
  "capitalone.com",
  "paypal.com",
  "stripe.com",
  "mychart",
  "patient",
  "epic",
  "adult",
  "onlyfans.com",
  "porn",
  "mail.google.com",
  "web.whatsapp.com",
  "messenger.com",
  "slack.com",
  "discord.com",
  "messages",
  "outlook.office.com",
  "instagram.com",
  "desmos.com",
  "rocketreach.com",
  "costar.com",
  "peacocktv.com",
  "fakeyourdrank",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "snapchat.com",
  "pinterest.com",
  "threads.net",
  "docs.google.com",
  "drive.google.com",
  "calendar.google.com",
  "accounts.google.com"
];

export const SENSITIVE_PATH_PATTERNS = [
  "/login",
  "/signin",
  "/messages",
  "/dm",
  "/mail",
  "/inbox",
  "/checkout",
  "/billing",
  "/payment",
  "/patient",
  "/portal",
  "/shorts",
  "/search/results",
  "/oauth",
  "/auth",
  "/sso"
];

export function isSensitiveDomain(domain: string) {
  const normalized = domain.toLowerCase();
  return SENSITIVE_DOMAIN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isSensitivePath(path: string) {
  const normalized = sanitizePath(path).toLowerCase();
  return SENSITIVE_PATH_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isBlockedDomain(domain: string) {
  return BLOCKED_DOMAINS.some((d) => domain.includes(d));
}

export function isSensitiveMetadata(domain: string, path: string) {
  return isBlockedDomain(domain) || isSensitiveDomain(domain) || isSensitivePath(path);
}

export function sanitizePath(path: string) {
  return path.split("?")[0] || "/";
}
