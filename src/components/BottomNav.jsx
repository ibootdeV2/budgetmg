import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/navigation";

/**
 * Barre de navigation fixe en bas de l'écran, visible uniquement sur mobile
 * (md:hidden). Remplace le besoin d'ouvrir le tiroir latéral pour naviguer
 * entre les 4 sections principales — un tap, à portée de pouce.
 *
 * `pb-[env(safe-area-inset-bottom)]` évite que les boutons soient masqués
 * par la barre de gestes des téléphones sans bouton physique (iPhone, Android récents).
 */
export default function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-medium transition-colors"
            )}
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "flex items-center justify-center h-7 w-9 rounded-full transition-colors",
                    isActive ? "bg-accent/15" : ""
                  )}
                >
                  <item.icon
                    className={cn("h-5 w-5", isActive ? "text-accent" : "text-muted-foreground")}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </span>
                <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
                  {item.shortLabel}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
