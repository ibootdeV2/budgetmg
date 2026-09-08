import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Wallet, Loader2, ArrowLeft, Eye, EyeOff, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import loginBg from "@/assets/login-bg.jpg";

const emptyForm = { email: "", password: "" };

const COPY = {
  signin: {
    title: "Connexion",
    topSubtitle: "Bon retour. Accédez à votre tableau de bord.",
    bottomText: "Pas encore de compte ?",
    switchLabel: "Créer un compte",
    switchTo: "signup",
    submitLabel: "Se connecter",
  },
  signup: {
    title: "Créer un compte",
    topSubtitle: "Rejoignez Budget-mg et prenez le contrôle de vos finances.",
    bottomText: "Déjà inscrit ?",
    switchLabel: "Se connecter",
    switchTo: "signin",
    submitLabel: "Créer mon compte",
  },
  forgot: {
    title: "Mot de passe oublié",
    topSubtitle: "Entrez votre adresse e-mail, nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    bottomText: "",
    switchLabel: "",
    switchTo: "signin",
    submitLabel: "Envoyer le lien",
  },
};

/* Logos "Google" / "Apple" en SVG inline (pas d'icône de marque dans lucide-react) */
function GoogleLogo(props) {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.4 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.4C41.5 36.3 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
function AppleLogo(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" {...props}>
      <path d="M16.365 1.43c0 1.14-.462 2.109-1.048 2.79-.65.75-1.71 1.34-2.66 1.27-.11-1.09.46-2.24 1.06-2.94.66-.77 1.79-1.34 2.65-1.12zM20.9 17.32c-.5 1.16-.74 1.68-1.39 2.7-.9 1.42-2.17 3.2-3.75 3.21-1.4.02-1.76-.91-3.66-.9-1.9.01-2.3.92-3.7.9-1.58-.02-2.78-1.61-3.68-3.03C1.94 17.24 1.5 12.98 3 10.65c1.06-1.65 2.74-2.62 4.31-2.62 1.6 0 2.6.9 3.92.9 1.28 0 2.06-.9 3.9-.9 1.4 0 2.88.76 3.93 2.08-3.46 1.9-2.9 6.85 1.84 7.2z" />
    </svg>
  );
}

export default function Login() {
  const { isAuthenticated, loading, signIn, signUp, signInWithOAuth, resetPassword } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [form, setForm] = useState(emptyForm);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState(null); // provider en cours de redirection, ou null

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  function switchMode(next) {
    setMode(next);
    setForm(emptyForm);
    setShowPassword(false);
  }

  async function handleSocialLogin(provider) {
    // "google" / "apple" : identifiants attendus par supabase.auth.signInWithOAuth.
    // Le provider DOIT être activé (avec Client ID/Secret) dans Supabase >
    // Authentication > Providers, sinon Supabase répond avec une erreur
    // explicite ("Unsupported provider") qu'on relaie via le toast ci-dessous.
    setOauthProvider(provider);
    try {
      await signInWithOAuth(provider, rememberMe);
      // Pas de code après ceci en cas de succès : le navigateur est redirigé
      // vers l'écran de consentement de Google/Apple avant que ce point soit
      // atteint.
    } catch (err) {
      toast({
        variant: "destructive",
        title: `Connexion ${provider === "google" ? "Google" : "Apple"} impossible`,
        description: err.message || "Une erreur est survenue.",
      });
      setOauthProvider(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || (mode !== "forgot" && !form.password)) return;
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(form.email, form.password, rememberMe);
      } else if (mode === "signup") {
        await signUp(form.email, form.password);
        toast({
          title: "Compte créé",
          description: "Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.",
        });
        switchMode("signin");
      } else {
        await resetPassword(form.email);
        toast({
          title: "E-mail envoyé",
          description: "Vérifiez votre boîte mail : un lien de réinitialisation vous a été envoyé.",
        });
        switchMode("signin");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title:
          mode === "signin" ? "Connexion impossible" : mode === "signup" ? "Inscription impossible" : "Envoi impossible",
        description: err.message || "Une erreur est survenue.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[mode];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Colonne gauche : panneau de marque (masqué sur mobile) */}
      <div
        className="hidden md:flex md:flex-col md:w-[42%] lg:w-[45%] relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        {/* Voile sombre teinté de la couleur de marque, pour garder logo et texte lisibles */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-primary/40"
          aria-hidden="true"
        />

        {/* Accroche de marque, centrée verticalement et horizontalement dans le panneau */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8">
          <div className="max-w-xl">
            <h2
              className="font-bold text-3xl sm:text-4xl lg:text-5xl leading-[1.15] text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Prenez le contrôle
              <br />
              <span className="text-primary">de vos finances.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Suivez vos dépenses, planifiez vos objectifs et
              <br />
              construisez la sécurité financière que vous méritez.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto w-full flex items-center gap-2 px-6 py-4 bg-black/20 backdrop-blur-sm">
          <span className="h-8 w-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="text-white font-display font-semibold">Budget-mg</span>
        </div>
      </div>

      {/* Colonne droite : formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          {/* Logo, visible uniquement sur mobile puisque le panneau de marque est masqué */}
          <div className="md:hidden flex justify-center mb-6">
            <span className="h-14 w-14 rounded-full bg-secondary text-primary flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </span>
          </div>

          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </button>
          ) : null}

          <div className="mb-8">
            <h1 className="text-5xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {copy.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">{copy.topSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
              >
                Adresse e-mail
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Mot de passe
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signin" && (
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground select-none">
                <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
                Se souvenir de moi
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold py-3 hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.submitLabel}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">ou continuer avec</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={!!oauthProvider}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {oauthProvider === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin("apple")}
                  disabled={!!oauthProvider}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {oauthProvider === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleLogo />}
                  Apple
                </button>
              </div>
            </>
          )}

          {copy.bottomText ? (
            <p className="text-sm text-center text-muted-foreground mt-8">
              {copy.bottomText}{" "}
              <button
                type="button"
                onClick={() => switchMode(copy.switchTo)}
                className="text-primary font-medium hover:underline"
              >
                {copy.switchLabel}
              </button>
            </p>
          ) : null}

          <p className="text-[11px] text-center text-muted-foreground/60 mt-6">
            En vous connectant, vous acceptez nos Conditions d'utilisation et notre politique de
            confidentialité.
          </p>
        </div>
      </div>

      {/* Bouton d'aide flottant — ouvre l'application mail de l'utilisateur,
          pré-remplie avec l'adresse de support. Aucune configuration côté
          serveur nécessaire : c'est un simple lien mailto. Pour changer
          l'adresse, modifie juste la valeur ci-dessous. */}
      <a
        href="mailto:support@kasaina.mg?subject=Besoin%20d'aide%20-%20Budget-mg"
        aria-label="Aide"
        className="fixed bottom-5 right-5 h-11 w-11 rounded-full bg-foreground text-background flex items-center justify-center shadow-warm-lg hover:opacity-90 transition-opacity"
      >
        <HelpCircle className="h-5 w-5" />
      </a>
    </div>
  );
}
