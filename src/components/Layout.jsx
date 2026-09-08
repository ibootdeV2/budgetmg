import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Coins, Menu, X, LogOut, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { navItems } from "@/lib/navigation";
import SyncStatus from "@/components/SyncStatus";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* En-tête mobile : liseré émeraude → or en signature de marque. */}
      <div className="md:hidden sticky top-0 z-30">
        <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
              <Coins className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="font-heading font-semibold tracking-tight">Budget-mg</span>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatus onDark />
            <ThemeToggle className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" />
            <button
              onClick={() => setOpen(true)}
              aria-label="Menu"
              className="touch-target -m-1.5 p-1.5 rounded-lg hover:bg-primary-foreground/10"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
              <Coins className="h-4.5 w-4.5" strokeWidth={2.25} />
            </span>
            <div>
              <p className="font-heading font-semibold leading-tight tracking-tight">Budget-mg</p>
              <p className="text-xs text-sidebar-foreground/50">budget · {new Date().getFullYear()}</p>
            </div>
          </div>
          <button className="md:hidden touch-target" onClick={() => setOpen(false)} aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-3 mt-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-sidebar-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <item.icon className="h-4 w-4" strokeWidth={2} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3 py-4 border-t border-sidebar-border">
          <div className="px-1 flex items-center justify-between">
            <span className="h-8 w-8 rounded-full bg-sidebar-accent text-sidebar-foreground flex items-center justify-center text-xs font-semibold uppercase shrink-0">
              {user?.email?.[0] ?? "?"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Paramètres du compte"
                  className="touch-target -m-1.5 p-1.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                >
                  <Settings className="h-4.5 w-4.5" strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-64">
                <DropdownMenuLabel className="truncate font-normal text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Synchro et thème sur deux lignes distinctes, chacune avec
                    son libellé : avant, les deux étaient collés sur une seule
                    ligne sans texte, et le badge de synchro était illisible
                    (couleurs pensées pour l'en-tête bleu, pas ce fond sombre). */}
                <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">Synchronisation</span>
                  <SyncStatus />
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">Mode sombre</span>
                  <ThemeToggle />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="gap-2">
                  <a href="mailto:support@kasaina.mg?subject=Besoin%20d'aide%20-%20Budget-mg">
                    <HelpCircle className="h-4 w-4" strokeWidth={2} />
                    Aide et support
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Se déconnecter
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <p className="px-2 py-1 text-[10px] text-muted-foreground">
                  © {new Date().getFullYear()} Budget-mg
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="md:pl-64 pb-24 md:pb-0">
        <Outlet />
        <p className="px-4 md:px-6 py-4 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Budget-mg. Tous droits réservés.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
