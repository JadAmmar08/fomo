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

    // Immediate pass for anything already on screen
    pending().forEach((el) => { if (inView(el)) reveal(el); });
    if (pending().length === 0) return;

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
    pending().forEach((el) => observer.observe(el));

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
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
