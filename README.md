# Budget MGA — Dashboard

Application de suivi budgétaire personnel : React (Vite) + Tailwind CSS côté
frontend, Supabase (Postgres + Auth) côté cloud, avec un fonctionnement
offline-first (localStorage + synchronisation automatique).

## Prérequis

- **Node.js ≥ 18.18** (voir `.nvmrc`). Vérifiez avec `node -v`.
- Un compte [Supabase](https://supabase.com) (gratuit) pour le backend.

## Installation

```bash
npm install
```

> Si `npm install` échoue avec une erreur `ERESOLVE` (conflit de versions),
> relancez avec :
> ```bash
> npm install --legacy-peer-deps
> ```
> Voir la section [Dépannage](#dépannage) plus bas pour les autres cas fréquents.

## Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez le contenu de `supabase/schema.sql` (crée les
   tables `transactions`, `budget_lines`, `savings_goals` et leurs règles de
   sécurité RLS).
3. Copiez `.env.example` vers `.env.local` :
   ```bash
   cp .env.example .env.local
   ```
4. Renseignez vos clés (**Project Settings → API** dans Supabase) :
   ```bash
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique
   ```

## Lancer le projet en local

```bash
npm run dev
```

Ouvrez l'URL affichée par Vite (par défaut `http://localhost:5173`).

## Scripts disponibles

| Commande          | Description                              |
|--------------------|-------------------------------------------|
| `npm run dev`      | Serveur de développement (hot reload)     |
| `npm run build`    | Build de production dans `dist/`          |
| `npm run preview`  | Prévisualise le build de production       |

## Structure du projet

```
src/
├── pages/          # Dashboard, Transactions, Budget, Goals, Login
├── components/      # UI (shadcn/ui) + composants applicatifs
├── hooks/            # useAuth, useTransactions, useBudget, useSavingsGoals,
│                     # useOfflineSync, useFinancialStats
├── services/
│   ├── storage.js   # Base locale (localStorage), CRUD, versionnement
│   ├── supabase.js  # Client Supabase + CRUD distant
│   └── sync.js       # Push/pull, résolution de conflits
└── lib/              # Utilitaires (catégories budgétaires, export PDF/Excel)
supabase/
└── schema.sql        # Schéma Postgres + RLS à exécuter dans Supabase
```

## Activer la connexion Google / Apple

Les boutons "Google" et "Apple" de l'écran de connexion appellent
`supabase.auth.signInWithOAuth()`. Le code est prêt, mais chaque fournisseur
doit être activé une fois dans le projet Supabase, sinon Supabase renvoie une
erreur (affichée dans un toast à l'utilisateur) :

1. Dans le tableau de bord Supabase : **Authentication → Providers**.
2. **Google** :
   - Créez un identifiant OAuth 2.0 dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     (type "Application Web").
   - Ajoutez comme "URI de redirection autorisé" celle indiquée par Supabase
     dans l'écran du provider Google (généralement
     `https://<votre-projet>.supabase.co/auth/v1/callback`).
   - Copiez le Client ID et le Client Secret dans Supabase, puis activez le
     provider.
3. **Apple** :
   - Nécessite un compte Apple Developer payant. Configurez "Sign in with
     Apple" dans le [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId)
     (Service ID, clé privée, Team ID, Key ID).
   - Renseignez ces valeurs côté Supabase (écran du provider Apple), avec la
     même URI de redirection que ci-dessus.
   - Activez le provider.
4. Dans **Authentication → URL Configuration**, ajoutez l'URL de votre app
   (ex. `http://localhost:5173` en dev, votre domaine en prod) à la liste des
   "Redirect URLs" — sinon Supabase refuse de rediriger l'utilisateur vers
   l'app après connexion.

Tant qu'un provider n'est pas activé, cliquer sur son bouton affiche un toast
d'erreur explicite plutôt que de planter silencieusement.

## Dépannage

**`npm install` échoue avec une erreur `ERESOLVE` / conflit de peer dependencies**
Essayez :
```bash
npm install --legacy-peer-deps
```
Si le problème persiste, supprimez `node_modules` et `package-lock.json` puis
réinstallez :
```bash
rm -rf node_modules package-lock.json
npm install
```

**`npm install` échoue avec une erreur liée à la version de Node**
Ce projet nécessite Node ≥ 18.18. Avec [nvm](https://github.com/nvm-sh/nvm) :
```bash
nvm install
nvm use
```

**L'app se lance mais affiche une page blanche / erreur dans la console**
Vérifiez que `.env.local` existe bien à la racine et contient des valeurs
Supabase valides (pas les valeurs d'exemple de `.env.example`).

**Erreur de connexion à Supabase / "Invalid API key"**
Vérifiez que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` correspondent
bien à votre projet (Project Settings → API), et que le fichier `.env.local`
est à la racine du projet (au même niveau que `package.json`), pas dans `src/`.
