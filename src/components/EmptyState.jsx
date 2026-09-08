import { cn } from "@/lib/utils";

/** État vide générique : icône + titre + description + action optionnelle. */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl border border-dashed border-border p-10 text-center",
        className
      )}
    >
      {Icon && (
        <span className="h-12 w-12 mx-auto mb-3 rounded-2xl bg-primary/10 text-primary/50 flex items-center justify-center">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      )}
      <p className="font-heading font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
