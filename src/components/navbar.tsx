"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NavLink = {
  href: string;
  label: string;
  icon?: React.ElementType;
  /** Render as a highlighted blue call-to-action button. */
  cta?: boolean;
};

export function Navbar({
  title,
  links = [],
  showLogout = false,
}: {
  title?: string;
  links?: NavLink[];
  showLogout?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Berhasil keluar.");
    router.push("/login");
    router.refresh();
  }

  // Link aktif = match terpanjang. Cegah "/admin" ikut nyala di
  // "/admin/participants" (dulu double indicator). Prefix harus batas segmen.
  const matchLen = (href: string) => {
    if (pathname === href) return href.length;
    if (href !== "/" && pathname.startsWith(href + "/")) return href.length;
    return -1;
  };
  const activeHref = links.reduce(
    (best, l) => (matchLen(l.href) > matchLen(best) ? l.href : best),
    ""
  );
  const isActive = (href: string) => href !== "" && href === activeHref;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="hidden bg-gradient-to-r from-primary to-blue-600 bg-clip-text font-bold leading-tight text-transparent sm:inline">
            Festival Karakter Pelajar
          </span>
          <span className="font-bold sm:hidden">FKP</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = l.icon;
            if (l.cta) {
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="ml-1 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] hover:shadow-md"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {l.label}
                </Link>
              );
            }
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20" />
                )}
                {Icon && <Icon className="h-4 w-4" />}
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
          {showLogout && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          )}
        </nav>

        {/* Mobile menu */}
        {(links.length > 0 || showLogout) && (
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {links.map((l) => {
                  const active = isActive(l.href);
                  const Icon = l.icon;
                  return (
                    <DropdownMenuItem key={l.href} asChild>
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "gap-2",
                          l.cta
                            ? "font-semibold text-primary"
                            : active &&
                                "bg-primary/10 font-medium text-primary focus:bg-primary/15"
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                        {l.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                {showLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={logout}
                      className="text-destructive focus:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {title && (
        <div className="border-t border-border/60 bg-muted/30">
          <div className="container py-3">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
        </div>
      )}
    </header>
  );
}
