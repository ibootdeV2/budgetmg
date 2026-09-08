import { useMemo, useState } from "react";
import { Plus, Search, FileSpreadsheet, FileUp, MoreVertical, CheckSquare, X, Trash2 } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransactionImport } from "@/hooks/useTransactionImport";
import { useTransactionSuggestion } from "@/hooks/useTransactionSuggestion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/components/ui/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ConfirmDialog";
import TransactionFormFields from "@/components/transactions/TransactionFormFields";
import TransactionsList from "@/components/transactions/TransactionsList";
import ImportPreviewDialog from "@/components/transactions/ImportPreviewDialog";
import { exportTransactionsToExcel } from "@/lib/export";
import { ALL_CATEGORIES, MONTHS, formatMGA, getCategoryType } from "@/lib/budgetCategories";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  category: ALL_CATEGORIES[0]?.name || "",
  type: getCategoryType(ALL_CATEGORIES[0]?.name),
  amount: "",
};

export default function Transactions() {
  const isMobile = useIsMobile();
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const {
    transactions,
    allTransactions,
    loading,
    addTransaction,
    updateTransaction,
    removeTransaction,
    removeTransactions,
    importTransactions,
  } = useTransactions({ month: monthFilter === "all" ? undefined : Number(monthFilter) });
  const { toast } = useToast();

  // --- Formulaire d'ajout / édition ---
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  // --- Sélection multiple : opt-in via le menu "⋮", n'affecte rien tant
  // qu'elle n'est pas activée (voir TransactionsList.jsx). ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // --- Import Excel / CSV : toute la logique vit dans ce hook dédié ---
  const {
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
  } = useTransactionImport({ allTransactions, importTransactions });

  // Auto-complétion : basée sur tout l'historique (pas seulement le mois
  // affiché), pour reconnaître "Marché" même si le filtre est sur un autre mois.
  const { getSuggestion } = useTransactionSuggestion(allTransactions);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (query && !t.description.toLowerCase().includes(query) && !t.category.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [transactions, categoryFilter, search]);

  // Clé stable qui ne change que si un vrai critère de filtre change (mois,
  // catégorie, recherche) — sert à réinitialiser la pagination sans réagir
  // à une simple modification/ajout de transaction sur la page courante.
  const filterKey = `${monthFilter}|${categoryFilter}|${search.trim().toLowerCase()}`;

  const total = filtered.reduce((s, t) => s + (t.type === "Revenu" ? t.amount : -t.amount), 0);

  function handleCategoryChange(category) {
    setForm((f) => ({
      // "Autres" peut être un revenu ou une dépense : si on re-sélectionne "Autres"
      // en gardant "Autres", on ne touche pas au type déjà choisi manuellement.
      ...f,
      category,
      type: category === "Autres" && f.category === "Autres" ? f.type : getCategoryType(category),
    }));
  }

  function handleTypeChange(type) {
    setForm((f) => ({ ...f, type }));
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      date: t.date,
      description: t.description,
      category: t.category,
      type: t.type,
      amount: t.amount,
    });
    if (isMobile) setSheetOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setSheetOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        description: form.description,
        category: form.category,
        type: form.type,
        amount: Number(form.amount),
      };
      if (editingId) {
        updateTransaction(editingId, payload);
        toast({ title: "Transaction modifiée", description: form.description });
      } else {
        addTransaction(payload);
        toast({ title: "Transaction ajoutée", description: form.description });
      }
      cancelEdit();
    } catch (err) {
      toast({ variant: "destructive", title: "Échec de l'enregistrement", description: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Chaque article détecté par le scan IA (voir ReceiptScanner.jsx) devient
  // sa propre transaction — un seul appel bulk plutôt qu'un import ligne par
  // ligne, comme pour l'import Excel/CSV.
  function handleScanImport(items) {
    if (!items?.length) return;
    const payloads = items.map((item) => ({
      date: item.date,
      description: item.title,
      category: item.category,
      type: item.type,
      amount: Number(item.amount),
    }));
    importTransactions(payloads);
  }

  function handleDelete(t) {
    setTransactionToDelete(t);
  }

  function confirmDeleteTransaction() {
    if (!transactionToDelete) return;
    const t = transactionToDelete;
    removeTransaction(t.id);
    toast({ title: "Transaction supprimée", description: t.description });
    if (editingId === t.id) cancelEdit();
    setTransactionToDelete(null);
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Accepte soit un seul id (case d'une ligne : bascule), soit un tableau
  // d'ids + une valeur forcée (case "sélectionner toute la page").
  function toggleSelect(idOrIds, forceValue) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (Array.isArray(idOrIds)) {
        idOrIds.forEach((id) => (forceValue ? next.add(id) : next.delete(id)));
      } else if (next.has(idOrIds)) {
        next.delete(idOrIds);
      } else {
        next.add(idOrIds);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  }

  function confirmBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    removeTransactions(ids);
    toast({ title: `${ids.length} transaction${ids.length > 1 ? "s" : ""} supprimée${ids.length > 1 ? "s" : ""}` });
    if (editingId && selectedIds.has(editingId)) cancelEdit();
    setBulkDeleteOpen(false);
    exitSelectionMode();
  }

  function handleExportExcel() {
    if (filtered.length === 0) return;
    exportTransactionsToExcel(filtered);
    toast({ title: "Export Excel généré", description: `${filtered.length} transaction(s)` });
  }

  const formFieldsProps = {
    form,
    setForm,
    handleCategoryChange,
    handleTypeChange,
    editingId,
    cancelEdit,
    saving,
    onScanImport: handleScanImport,
    getSuggestion,
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Mouvements</p>
          <h1 className="text-3xl font-heading font-semibold tracking-tight">Transactions</h1>
          <p className="font-figure text-sm text-muted-foreground mt-0.5">
            {filtered.length} transaction{filtered.length > 1 ? "s" : ""} · Solde{" "}
            <span className="text-foreground font-semibold">{formatMGA(total)}</span>
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Autres actions : importer, exporter"
              className="touch-target self-end md:self-auto p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={enterSelectionMode} className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Sélectionner plusieurs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick} className="gap-2">
              <FileUp className="h-4 w-4" />
              Importer depuis Excel/CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exporter en Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une description ou une catégorie…"
            aria-label="Rechercher une transaction"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Filtrer par mois"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-fit"
        >
          <option value="all">Tous les mois</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filtrer par catégorie"
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-fit"
        >
          <option value="all">Toutes les catégories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Formulaire inline — desktop uniquement, réservé à l'ajout d'une nouvelle transaction.
          La modification s'ouvre dans une fenêtre modale (voir plus bas) pour éviter d'avoir
          à remonter en haut de page quand on édite une ligne plus bas dans la liste. */}
      {!editingId && (
        <form
          onSubmit={handleSubmit}
          className="hidden md:grid bg-card rounded-2xl border border-border p-5 shadow-warm-sm grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <TransactionFormFields {...formFieldsProps} layout="inline" />
        </form>
      )}

      {/* Barre d'outils de sélection multiple — n'apparaît que si activée
          depuis le menu "⋮" ; ne modifie rien d'autre dans la page. */}
      {selectionMode && (
        <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-sm font-medium text-foreground shrink-0">
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </p>
            {selectedIds.size < filtered.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-sm text-primary hover:underline shrink-0"
              >
                Tout sélectionner ({filtered.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedIds.size === 0}
              className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium px-3 py-2 hover:bg-destructive/90 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={exitSelectionMode}
              aria-label="Annuler la sélection"
              className="touch-target p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <TransactionsList
        loading={loading}
        filtered={filtered}
        filterKey={filterKey}
        hasAnyTransaction={transactions.length > 0}
        onEdit={startEdit}
        onDelete={handleDelete}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      {/* Bouton flottant — mobile uniquement. Ouvre le formulaire en feuille modale. */}
      <button
        type="button"
        onClick={() => {
          if (!editingId) setForm(emptyForm);
          setSheetOpen(true);
        }}
        aria-label="Ajouter une transaction"
        className="md:hidden fixed z-20 right-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-warm-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={sheetOpen} onOpenChange={(open) => (open ? setSheetOpen(true) : cancelEdit())}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+24px)]">
          <SheetHeader className="text-left">
            <SheetTitle>{editingId ? "Modifier la transaction" : "Nouvelle transaction"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <TransactionFormFields {...formFieldsProps} layout="sheet" />
          </form>
        </SheetContent>
      </Sheet>

      {/* Édition desktop — modale centrée, s'ouvre immédiatement au clic sur "Modifier",
          peu importe où on a scrollé dans la liste. */}
      <Dialog open={!!editingId && !isMobile} onOpenChange={(open) => !open && cancelEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <TransactionFormFields {...formFieldsProps} layout="sheet" />
          </form>
        </DialogContent>
      </Dialog>

      <ImportPreviewDialog
        importPreview={importPreview}
        importing={importing}
        editImportRow={editImportRow}
        toggleRowExcluded={toggleRowExcluded}
        setDuplicateDecision={setDuplicateDecision}
        closeImportPreview={closeImportPreview}
        confirmImport={confirmImport}
      />

      <ConfirmDialog
        open={!!transactionToDelete}
        onOpenChange={(open) => !open && setTransactionToDelete(null)}
        title="Supprimer cette transaction ?"
        description={
          transactionToDelete
            ? `"${transactionToDelete.description}" sera définitivement supprimée. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteTransaction}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Supprimer ${selectedIds.size} transaction${selectedIds.size > 1 ? "s" : ""} ?`}
        description="Ces transactions seront définitivement supprimées. Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
