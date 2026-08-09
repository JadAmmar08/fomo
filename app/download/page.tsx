import { redirect } from "next/navigation";

// Retired: this used to pitch installing a Chrome extension that tracked
// browsing ("page titles, time spent") for the old research-intelligence
// product. Current onboarding has no separate install step — connecting
// OneDrive/Google Drive/Slack happens right inside a team page.
export default function DownloadPage() {
  redirect("/teams");
}
