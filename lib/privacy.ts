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
  "outlook.office.com"
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
  "/portal"
];

export function isSensitiveDomain(domain: string) {
  const normalized = domain.toLowerCase();
  return SENSITIVE_DOMAIN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isSensitivePath(path: string) {
  const normalized = sanitizePath(path).toLowerCase();
  return SENSITIVE_PATH_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isSensitiveMetadata(domain: string, path: string) {
  return isSensitiveDomain(domain) || isSensitivePath(path);
}

export function sanitizePath(path: string) {
  return path.split("?")[0] || "/";
}
