import { useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { parseTransactionsFile, buildDraftRow, rowHasErrors, markDuplicates, isDuplicate } from "@/lib/importExcel";

/**
 * Toute la logique d'import de transactions depuis un fichier Excel/CSV :
 * lecture du fichier, détection des doublons probables, correction manuelle
 * des lignes en erreur dans l'aperçu, puis import final.
 *
 * Isolée dans son propre hook pour ne pas alourdir davantage la page
 * Transactions (déjà volumineuse) — la logique d'import est indépendante
 * de l'affichage de la liste ou du formulaire d'ajout/édition.
 *
 * @param {object} deps
 * @param {Array} deps.allTransactions - transactions existantes, pour la détection de doublons
 * @param {(rows: object[]) => void} deps.importTransactions - fonction d'écriture fournie par useTransactions
 */
export function useTransactionImport({ allTransactions, importTransactions }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null); // { rows: DraftRow[] } — chaque ligne porte _excluded, _isDuplicate, fieldErrors
  const [importing, setImporting] = useState(false);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    try {
      const { rows } = await parseTransactionsFile(file);
      const withDuplicateFlag = markDuplicates(rows, allTransactions);
      // Exclue par défaut : lignes en erreur (impossible à importer telles quelles) et doublons probables.
      const withDefaults = withDuplicateFlag.map((r) => ({
        ...r,
        _excluded: rowHasErrors(r) || r._isDuplicate,
      }));
      setImportPreview({ rows: withDefaults });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Impossible de lire ce fichier",
        description: err.message || "Vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx) ou CSV.",
      });
    }
  }

  /** Recalcule une ligne après une correction manuelle dans l'aperçu (champ édité par l'utilisateur). */
  function editImportRow(sourceRow, patch) {
    setImportPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) => {
        if (r._sourceRow !== sourceRow) return r;
        const hadErrors = rowHasErrors(r);
        const rebuilt = buildDraftRow({ ...r.raw, ...patch }, sourceRow);
        rebuilt._isDuplicate = isDuplicate(rebuilt, allTransactions);
        // Ligne toujours invalide -> reste exclue. Ligne qui vient d'être corrigée -> on l'inclut
        // automatiquement sauf si elle s'avère être un doublon. Ligne déjà valide avant -> on garde
        // le choix (case à cocher / décision doublon) déjà fait par l'utilisateur.
        rebuilt._excluded = rowHasErrors(rebuilt)
          ? true
          : hadErrors
          ? rebuilt._isDuplicate
          : r._excluded;
        return rebuilt;
      });
      return { ...prev, rows };
    });
  }

  function toggleRowExcluded(sourceRow) {
    setImportPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) =>
        r._sourceRow === sourceRow && !rowHasErrors(r) ? { ...r, _excluded: !r._excluded } : r
      );
      return { ...prev, rows };
    });
  }

  /** Décision explicite pour une ligne en doublon probable : true = "c'est un doublon, ignorer", false = "ce n'est pas un doublon, importer". */
  function setDuplicateDecision(sourceRow, isRealDuplicate) {
    setImportPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) =>
        r._sourceRow === sourceRow ? { ...r, _excluded: isRealDuplicate } : r
      );
      return { ...prev, rows };
    });
  }

  function closeImportPreview() {
    setImportPreview(null);
  }

  async function confirmImport() {
    if (!importPreview) return;
    const rowsToImport = importPreview.rows
      .filter((r) => !r._excluded && !rowHasErrors(r))
      .map(({ _sourceRow, raw, categoryWasFallback, originalCategoryRaw, fieldErrors, _isDuplicate, _excluded, ...payload }) => payload);

    if (rowsToImport.length === 0) {
      toast({ variant: "destructive", title: "Aucune ligne à importer", description: "Toutes les lignes sont exclues ou encore invalides." });
      return;
    }

    setImporting(true);
    try {
      importTransactions(rowsToImport);
      toast({ title: "Import terminé", description: `${rowsToImport.length} transaction(s) ajoutée(s)` });
      closeImportPreview();
    } catch (err) {
      toast({ variant: "destructive", title: "Échec de l'import", description: err.message });
    } finally {
      setImporting(false);
    }
  }

  return {
    fileInputRef,
    importPreview,
    importing,
    handleImportClick,
    handleFileSelected,
    editImportRow,
    toggleRowExcluded,
    setDuplicateDecision,
    closeImportPreview,
    confirmImport,
  };
}
