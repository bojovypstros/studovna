"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";

export function SiteHeader({
  links,
  signedIn,
}: {
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    if (!header || !inner) return;
    const measure = () => {
      header.classList.add("is-wide", "is-measuring");
      const fits = inner.scrollWidth <= inner.clientWidth + 1;
      header.classList.toggle("is-wide", fits);
      header.classList.remove("is-measuring");
      setWide(fits);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [links.length, signedIn]);

  return (
    <header className="site-header" ref={headerRef} data-wide={wide ? "true" : "false"}>
      <div className="header-inner" ref={innerRef}>
        <Link className="site-logo" href="/">
          Studovna
        </Link>
        <nav className="site-nav" aria-label="Hlavní">
          <button
            className="menu-button"
            type="button"
            popoverTarget="site-menu"
            popoverTargetAction="toggle"
            aria-controls="site-menu"
          >
            Menu
          </button>
          <ul id="site-menu" className="site-menu" popover={wide ? undefined : "auto"}>
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
                  {link.label}
                </Link>
              </li>
            ))}
            {signedIn ? (
              <li>
                <form action={logoutAction}>
                  <button type="submit">Odhlásit</button>
                </form>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  );
}
