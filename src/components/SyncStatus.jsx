import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

/**
 * Petit badge de statut : en ligne/hors ligne, synchro en cours, nb d'éléments en attente.
 *
 * `onDark` bascule la couleur de l'état "à jour" (idle) pour rester lisible
 * sur un fond sombre saturé (l'en-tête mobile, en bleu "primary"). Par défaut
 * (false), le badge utilise des couleurs neutres qui restent lisibles sur
 * n'importe quel fond clair/sombre, notamment le popover du menu compte.
 * Les états hors-ligne / en attente gardent toujours leurs couleurs
 * d'alerte (rouge/ambre), quel que soit `onDark`.
 */
export default function SyncStatus({ className, onDark = false }) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  const label = !isOnline
    ? "Hors ligne"
    : isSyncing
    ? "Synchronisation…"
    : pendingCount > 0
    ? `${pendingCount} en attente`
    : "À jour";

  const idleColors = onDark
    ? "bg-primary-foreground/10 text-primary-foreground/80"
    : "bg-muted text-muted-foreground";

  return (
    <button
      type="button"
      onClick={() => isOnline && syncNow()}
      title={isOnline ? "Forcer la synchronisation" : "Pas de connexion réseau"}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        !isOnline ? "bg-destructive/15 text-destructive" : pendingCount > 0 ? "bg-amber-500/15 text-amber-600" : idleColors,
        className
      )}
    >
      {!isOnline ? (
        <CloudOff className="h-3.5 w-3.5" />
      ) : isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Cloud className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
