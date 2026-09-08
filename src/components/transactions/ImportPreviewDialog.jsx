import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { rowHasErrors } from "@/lib/importExcel";
import { ALL_CATEGORIES, formatMGA } from "@/lib/budgetCategories";

/**
 * Aperçu (et correction) des lignes détectées dans un fichier Excel/CSV avant
 * import définitif : lignes en erreur éditables, doublons probables à trancher,
 * lignes valides à cocher/décocher.
 *
 * Toute la logique d'état vient de useTransactionImport ; ce composant ne fait
 * que l'afficher et déclencher les callbacks fournis.
 */
export default function ImportPreviewDialog({
  importPreview,
  importing,
  editImportRow,
  toggleRowExcluded,
  setDuplicateDecision,
  closeImportPreview,
  confirmImport,
}) {
  return (
    <Dialog open={!!importPreview} onOpenChange={(open) => !open && closeImportPreview()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Aperçu de l'import</DialogTitle>
          <DialogDescription>
            Corrigez directement les lignes en rouge (elles ne sont pas importables telles quelles),
            et confirmez ou infirmez chaque doublon probable avant de valider.
          </DialogDescription>
        </DialogHeader>

        {importPreview && (() => {
          const errorCount = importPreview.rows.filter(rowHasErrors).length;
          const duplicateCount = importPreview.rows.filter((r) => r._isDuplicate).length;
          const readyCount = importPreview.rows.filter((r) => !r._excluded && !rowHasErrors(r)).length;
          return (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{readyCount} prête(s) à importer</Badge>
                {errorCount > 0 && <Badge variant="destructive">{errorCount} à corriger</Badge>}
                {duplicateCount > 0 && (
                  <Badge variant="outline">{duplicateCount} doublon(s) probable(s)</Badge>
                )}
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                {/* Le tableau a 6 colonnes et ne peut pas raisonnablement
                    tenir sur un écran mobile : on laisse défiler horizontalement
                    ce conteneur interne (plutôt que de couper les colonnes en
                    trop, invisible avec overflow-hidden sur le tableau lui-même). */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="text-left font-medium px-3 py-2">Date</th>
                      <th className="text-left font-medium px-3 py-2">Description</th>
                      <th className="text-left font-medium px-3 py-2">Catégorie</th>
                      <th className="text-left font-medium px-3 py-2">Type</th>
                      <th className="text-right font-medium px-3 py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((r) => {
                      const hasErrors = rowHasErrors(r);

                      // ---- Ligne invalide : champs éditables + messages d'erreur ----
                      if (hasErrors) {
                        return (
                          <tr key={r._sourceRow} className="border-t border-border bg-destructive/5 align-top">
                            <td className="px-3 py-2 pt-3">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={r.date || ""}
                                onChange={(ev) => editImportRow(r._sourceRow, { date: ev.target.value })}
                                className={`w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                                  r.fieldErrors.date ? "border-destructive" : "border-border"
                                }`}
                              />
                              {r.fieldErrors.date && (
                                <p className="mt-1 text-xs text-destructive">{r.fieldErrors.date}</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={r.description}
                                onChange={(ev) => editImportRow(r._sourceRow, { description: ev.target.value })}
                                placeholder="Description"
                                className={`w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                                  r.fieldErrors.description ? "border-destructive" : "border-border"
                                }`}
                              />
                              {r.fieldErrors.description && (
                                <p className="mt-1 text-xs text-destructive">{r.fieldErrors.description}</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={r.category}
                                onChange={(ev) => editImportRow(r._sourceRow, { category: ev.target.value })}
                                className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                {ALL_CATEGORIES.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              {r.categoryWasFallback && r.originalCategoryRaw && (
                                <p className="mt-1 text-xs text-warning">
                                  non reconnue : « {r.originalCategoryRaw} »
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={r.type}
                                onChange={(ev) => editImportRow(r._sourceRow, { type: ev.target.value })}
                                className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="Dépense">Dépense</option>
                                <option value="Revenu">Revenu</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                inputMode="decimal"
                                value={isNaN(r.amount) ? "" : r.amount}
                                onChange={(ev) => editImportRow(r._sourceRow, { amount: ev.target.value })}
                                placeholder="0"
                                className={`w-full rounded-lg border px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring ${
                                  r.fieldErrors.amount ? "border-destructive" : "border-border"
                                }`}
                              />
                              {r.fieldErrors.amount && (
                                <p className="mt-1 text-xs text-destructive">{r.fieldErrors.amount}</p>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      // ---- Ligne valide, mais doublon probable : décision explicite ----
                      if (r._isDuplicate) {
                        return (
                          <tr key={r._sourceRow} className="border-t border-border bg-warning/10">
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {new Date(r.date).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="px-3 py-2 font-medium">{r.description}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                            <td className="px-3 py-2">
                              <div
                                className={`text-right tabular-nums font-medium mb-1.5 ${
                                  r.type === "Revenu" ? "text-success" : "text-destructive"
                                }`}
                              >
                                {r.type === "Revenu" ? "+" : "-"}
                                {formatMGA(r.amount)}
                              </div>
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setDuplicateDecision(r._sourceRow, true)}
                                  title="C'est bien un doublon : ne pas importer cette ligne"
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                                    r._excluded
                                      ? "border-warning/40 bg-warning/15 text-warning"
                                      : "border-border text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <ShieldAlert className="h-3 w-3" />
                                  Doublon
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDuplicateDecision(r._sourceRow, false)}
                                  title="Ce n'est pas un doublon : importer cette ligne quand même"
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                                    !r._excluded
                                      ? "border-success/40 bg-success/15 text-success"
                                      : "border-border text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  Pas un doublon
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // ---- Ligne valide, standard : simple case à cocher ----
                      return (
                        <tr
                          key={r._sourceRow}
                          className={`border-t border-border ${r._excluded ? "opacity-40" : ""}`}
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={!r._excluded}
                              onCheckedChange={() => toggleRowExcluded(r._sourceRow)}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {new Date(r.date).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-3 py-2 font-medium">{r.description}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {r.category}
                            {r.categoryWasFallback && r.originalCategoryRaw && (
                              <span className="ml-1.5 text-xs text-warning">
                                (non reconnue : « {r.originalCategoryRaw} »)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium ${
                              r.type === "Revenu" ? "text-success" : "text-destructive"
                            }`}
                          >
                            {r.type === "Revenu" ? "+" : "-"}
                            {formatMGA(r.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          );
        })()}

        <DialogFooter>
          <button
            type="button"
            onClick={closeImportPreview}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirmImport}
            disabled={importing || !importPreview?.rows.length}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {importing ? "Import en cours…" : "Confirmer l'import"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
