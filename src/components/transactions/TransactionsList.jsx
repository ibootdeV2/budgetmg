import { useEffect, useState } from "react";
import { MoreVertical, Pencil, Trash2, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { formatMGA } from "@/lib/budgetCategories";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 50;

/** Menu "⋮" regroupant Modifier / Supprimer pour une transaction. */
function RowActionsMenu({ transaction, onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Actions sur la transaction"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground touch-target"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(transaction)} className="gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(transaction)}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Affiche les transactions filtrées : cartes empilées sur mobile (un tableau
 * qui défile horizontalement est pénible au pouce), tableau classique sur
 * desktop. Gère aussi les états de chargement et "aucun résultat".
 *
 * Pagination côté client par lots de 50 : au-delà de quelques centaines de
 * lignes (import Excel massif, plusieurs années d'historique), afficher tout
 * d'un coup ralentit le rendu — surtout sur les téléphones d'entrée de gamme
 * visés par l'app. Une vraie virtualisation (react-virtual) irait plus loin,
 * mais la pagination suffit largement ici et n'ajoute aucune dépendance.
 *
 * Sélection multiple : `selectionMode` est un opt-in explicite (activé
 * depuis le menu "⋮" de la page) — tant qu'il est désactivé, aucune case à
 * cocher n'apparaît et le rendu est identique à avant. Ça évite de perturber
 * l'usage courant (juste consulter/éditer une transaction).
 */
export default function TransactionsList({
  loading,
  filtered,
  filterKey,
  hasAnyTransaction,
  onEdit,
  onDelete,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Revenir à la page 1 uniquement quand un vrai critère de filtre change
  // (mois, catégorie, recherche) — pas quand le contenu d'une transaction
  // change (édition, ajout), sinon on est renvoyé en page 1 à chaque
  // modification effectuée depuis la page 2, 3, etc.
  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const currentPage = Math.min(page, pageCount);
  const pageItems =
    filtered.length > PAGE_SIZE
      ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
      : filtered;

  const allPageSelected = selectionMode && pageItems.length > 0 && pageItems.every((t) => selectedIds.has(t.id));

  if (loading) {
    return (
      <>
        <div className="md:hidden space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border shadow-warm-sm p-4 h-[68px] animate-pulse" />
          ))}
        </div>
        <div className="hidden md:block bg-card rounded-2xl border border-border shadow-warm-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <TableSkeleton rows={6} columns={5} />
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title={hasAnyTransaction ? "Aucun résultat pour ces filtres" : "Aucune transaction pour le moment"}
        description={
          hasAnyTransaction
            ? "Essayez une autre recherche ou réinitialisez les filtres."
            : "Ajoutez votre première transaction avec le bouton + ci-dessous."
        }
      />
    );
  }

  return (
    <>
      {/* Liste en cartes — mobile uniquement. Une table qui défile horizontalement est
          pénible au pouce ; ici chaque transaction tient sur une carte, actions à portée. */}
      <ul className="md:hidden space-y-2">
        {pageItems.map((t) => (
          <li
            key={t.id}
            className={`bg-card rounded-2xl border shadow-warm-sm p-4 transition-colors ${
              selectionMode && selectedIds.has(t.id) ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              {selectionMode && (
                <Checkbox
                  checked={selectedIds.has(t.id)}
                  onCheckedChange={() => onToggleSelect(t.id)}
                  aria-label={`Sélectionner ${t.description}`}
                  className="mt-0.5 shrink-0"
                />
              )}
              <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.date).toLocaleDateString("fr-FR")} · {t.category}
                  </p>
                </div>
                <p
                  className={`font-figure text-sm font-semibold whitespace-nowrap ${
                    t.type === "Revenu" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "Revenu" ? "+" : "-"}
                  {formatMGA(t.amount)}
                </p>
              </div>
            </div>
            {!selectionMode && (
              <div className="flex items-center justify-end mt-2 -mb-1 -mr-1.5">
                <RowActionsMenu transaction={t} onEdit={onEdit} onDelete={onDelete} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Table — desktop uniquement. */}
      <div className="hidden md:block bg-card rounded-2xl border border-border shadow-warm-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {selectionMode && (
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={() => onToggleSelect(pageItems.map((t) => t.id), !allPageSelected)}
                      aria-label="Sélectionner toute la page"
                    />
                  </th>
                )}
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-left font-medium px-4 py-3">Description</th>
                <th className="text-left font-medium px-4 py-3">Catégorie</th>
                <th className="text-right font-medium px-4 py-3">Montant</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t) => (
                <tr
                  key={t.id}
                  className={`border-t border-border hover:bg-muted/20 ${
                    selectionMode && selectedIds.has(t.id) ? "bg-primary/5" : ""
                  }`}
                >
                  {selectionMode && (
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => onToggleSelect(t.id)}
                        aria-label={`Sélectionner ${t.description}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{t.description}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.category}</td>
                  <td
                    className={`font-figure px-4 py-2.5 text-right font-medium ${
                      t.type === "Revenu" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.type === "Revenu" ? "+" : "-"}
                    {formatMGA(t.amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    {!selectionMode && (
                      <div className="flex items-center justify-end">
                        <RowActionsMenu transaction={t} onEdit={onEdit} onDelete={onDelete} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Page précédente"
              className="touch-target p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              aria-label="Page suivante"
              className="touch-target p-2 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
