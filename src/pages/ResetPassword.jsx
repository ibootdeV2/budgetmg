import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Loader2, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

/**
 * Page atteinte via le lien reçu par e-mail (resetPassword). Supabase établit
 * automatiquement une session "recovery" à partir du token présent dans l'URL
 * (`detectSessionInUrl: true` dans services/supabase.js) — l'utilisateur est
 * donc déjà authentifié ici, il ne lui reste qu'à choisir un nouveau mot de passe.
 */
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Mot de passe trop court", description: "6 caractères minimum." });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Les mots de passe ne correspondent pas" });
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast({ title: "Mot de passe mis à jour", description: "Vous êtes connecté(e)." });
      navigate("/", { replace: true });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Échec de la mise à jour",
        description: err.message || "Le lien a peut-être expiré, redemandez-en un nouveau.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <span className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-heading font-semibold">Budget MG</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="font-medium text-sm">Nouveau mot de passe</p>
              <p className="text-xs text-muted-foreground">Choisissez un mot de passe pour votre compte.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Nouveau mot de passe
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mettre à jour le mot de passe
            </Button>
          </form>
        </div>
        <p className="text-[11px] text-center text-muted-foreground/60 mt-6">
  © {new Date().getFullYear()} Budget MGA
</p>
      </div>
    </div>
  );
}
