import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/**
 * Boîte de confirmation générique, à la place de window.confirm() :
 * cohérente avec le design system (rounded-2xl, tokens de couleur) et
 * accessible (focus trap, fermeture au clavier gérés par Radix).
 *
 * Usage :
 *   const [pending, setPending] = useState(null); // l'élément à supprimer, ou null
 *   <ConfirmDialog
 *     open={!!pending}
 *     onOpenChange={(open) => !open && setPending(null)}
 *     title="Supprimer cette transaction ?"
 *     description={`"${pending?.description}" sera définitivement supprimée.`}
 *     confirmLabel="Supprimer"
 *     onConfirm={() => { doDelete(pending); setPending(null); }}
 *   />
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "destructive",
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              variant === "destructive"
                ? "rounded-xl bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                : "rounded-xl"
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
