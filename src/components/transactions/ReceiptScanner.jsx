import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, X, FileText, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { scanReceipt } from "@/services/aiScanner";
import { ALL_CATEGORIES, getCategoryType } from "@/lib/budgetCategories";

/**
 * Bouton "Scanner un reçu" + modale de scan IA.
 * Upload d'une image ou d'un PDF de reçu/facture, extraction IA d'UNE LIGNE
 * PAR ARTICLE (pas un total agrégé), revue/édition de chaque ligne, puis
 * validation en bloc via `onScanSuccess(items)` — un tableau d'objets
 * { title, amount, date, category, type }, un par transaction à créer.
 */
export default function ReceiptScanner({ onScanSuccess, className = "h-[42px] w-[42px]" }) {
  const inputRef = useRef(null);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | review | error
  const [errorMsg, setErrorMsg] = useState("");
  const [items, setItems] = useState([]);

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setErrorMsg("");
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function closeDialog() {
    setOpen(false);
    reset();
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setStatus("idle");
    setErrorMsg("");
    setFile(selected);
    setPreviewUrl(selected.type === "application/pdf" ? null : URL.createObjectURL(selected));
  }

  async function handleScan() {
    if (!file) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = await scanReceipt(file);
      setItems(result);
      setStatus("review");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Une erreur est survenue pendant le scan.");
    }
  }

  function updateItem(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function updateItemCategory(index, category) {
    const matched = ALL_CATEGORIES.find((c) => c.name === category);
    updateItem(index, { category, type: matched ? getCategoryType(category) : items[index].type });
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    if (!items.length) return;
    onScanSuccess(items);
    toast({
      title: `${items.length} transaction${items.length > 1 ? "s" : ""} ajoutée${items.length > 1 ? "s" : ""}`,
      description: "À partir du reçu scanné.",
    });
    closeDialog();
  }

  const itemsTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scanner un reçu"
        title="Scanner un reçu"
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-warm-sm hover:bg-primary/90 active:scale-95 transition-all touch-target shrink-0 ${className}`}
      >
        <Camera className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className={status === "review" ? "sm:max-w-lg" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>
              {status === "review" ? "Vérifiez les articles détectés" : "Scanner un reçu ou une facture"}
            </DialogTitle>
          </DialogHeader>

          {status !== "review" && (
            <div className="space-y-4">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {!file && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border py-10 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm font-medium">Choisir une photo ou un PDF</span>
                  <span className="text-xs">JPG, PNG ou PDF — 10 Mo max</span>
                </button>
              )}

              {file && (
                <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Aperçu du reçu" className="w-full max-h-64 object-contain" />
                  ) : (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <FileText className="h-5 w-5 shrink-0" />
                      {file.name}
                    </div>
                  )}
                </div>
              )}

              {status === "loading" && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyse du reçu par l'IA…
                </div>
              )}

              {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}

              {file && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={status === "loading"}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3 py-2.5 hover:bg-primary/90 disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : status === "error" ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {status === "error" ? "Réessayer" : "Analyser"}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={status === "loading"}
                    className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 hover:bg-muted disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Revue des articles : chaque ligne du reçu devient une transaction
              distincte. On laisse la personne corriger libellé/montant/catégorie
              ou supprimer une ligne (ex : un article mal détecté) avant validation. */}
          {status === "review" && (
            <div className="space-y-4">
              <div className="max-h-80 overflow-y-auto space-y-2 -mx-1 px-1">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border p-2.5 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(i, { title: e.target.value })}
                        className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Description"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Supprimer cette ligne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={item.category}
                        onChange={(e) => updateItemCategory(i, e.target.value)}
                        className="w-full min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={item.amount}
                        onChange={(e) => updateItem(i, { amount: e.target.value })}
                        className="w-full sm:w-28 sm:shrink-0 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                ))}
                {!items.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Toutes les lignes ont été supprimées.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm font-medium px-1">
                <span className="text-muted-foreground">
                  {items.length} ligne{items.length > 1 ? "s" : ""}
                </span>
                <span className="tabular-nums">{itemsTotal.toLocaleString("fr-FR")} MGA</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!items.length}
                  className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3 py-2.5 hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Ajouter {items.length} transaction{items.length > 1 ? "s" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
