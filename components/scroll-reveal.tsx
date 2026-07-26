"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reveal = (el: HTMLElement) => {
      const delay = el.dataset.revealDelay;
      if (delay) el.style.transitionDelay = `${delay}ms`;
      el.classList.add("revealed");
    };

    const inView = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight - 30 && rect.bottom > 0;
    };

    const pending = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.revealed)"));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    const scan = () => {
      pending().forEach((el) => {
        if (inView(el)) reveal(el);
        else observer.observe(el);
      });
    };

    // Immediate pass for anything already on screen, then observe the rest.
    scan();

    // Client components (e.g. panels that fetch on mount) can add new
    // [data-reveal] elements after this effect has already run — without this,
    // anything mounted later never gets picked up and stays invisible forever.
    const mutationObserver = new MutationObserver(scan);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Scroll fallback — covers throttled tabs and any IO edge cases
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        pending().forEach((el) => { if (inView(el)) reveal(el); });
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
