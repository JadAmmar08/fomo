"use client";

import { useEffect } from "react";
import { initMicrosoftAuthRedirectHandling } from "@/components/microsoft-picker";

// Mounted globally in the root layout so the OneDrive picker's post-login redirect
// gets caught no matter which page Microsoft sends the user back to.
export function MicrosoftAuthRedirectHandler() {
  useEffect(() => {
    initMicrosoftAuthRedirectHandling();
  }, []);
  return null;
}
