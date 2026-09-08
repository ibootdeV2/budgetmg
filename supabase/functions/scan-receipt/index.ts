// ============================================================================
// supabase/functions/scan-receipt/index.ts
// Edge Function : reçoit une image ou un PDF de reçu/facture en Base64,
// appelle Gemini (niveau gratuit) côté serveur, et renvoie un JSON structuré
// prêt à préremplir le formulaire de transaction.
//
// La clé API n'est JAMAIS exposée au client : elle vit uniquement dans les
// secrets de la fonction.
//   1. Récupère une clé gratuite sur https://aistudio.google.com/apikey
//   2. supabase secrets set GEMINI_API_KEY=xxxx
//   3. supabase functions deploy scan-receipt
// ============================================================================

import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Modèle gratuit (quota limité selon le tier) : gère nativement l'image et
// le PDF, et supporte la sortie JSON forcée. Passer à "gemini-3.5-flash-lite"
// si tu as besoin de plus de requêtes/jour, ou à un modèle Pro (payant) pour
// des reçus manuscrits/très dégradés.
const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: "Clé API IA non configurée côté serveur." }, 500);
    }

    const { fileBase64, mediaType, categories } = await req.json();

    if (!fileBase64 || !mediaType) {
      return jsonResponse({ error: "Fichier manquant." }, 400);
    }
    if (!ACCEPTED_TYPES.includes(mediaType)) {
      return jsonResponse({ error: "Format de fichier non supporté." }, 400);
    }

    const categoryNames =
      Array.isArray(categories) && categories.length
        ? categories.map((c) => (typeof c === "string" ? c : c.name)).join(", ")
        : "Alimentation, Transport, Loisirs, Shopping, Santé, Autres";

    const prompt = `Tu es un assistant d'extraction de données pour une application de gestion budgétaire malgache (devise MGA).
Analyse le reçu/facture fourni et retourne UNIQUEMENT un objet JSON strict avec exactement ces clés :
{
  "date": string au format YYYY-MM-DD (date du reçu ; si absente, utilise la date du jour),
  "items": [
    {
      "title": string (nom court de l'article ou de la ligne, ex : "Riz local 1kg"),
      "amount": number (montant de CETTE LIGNE uniquement, sans symbole ni séparateur de milliers),
      "category": string (la catégorie la plus proche PARMI CETTE LISTE EXACTE : ${categoryNames}),
      "type": "expense" | "income"
    }
  ]
}
Crée UNE entrée dans "items" PAR ARTICLE/LIGNE du reçu (ne renvoie jamais une seule ligne avec le total agrégé si le détail des articles est visible). Si le document ne contient qu'un montant global sans détail d'articles (ex : facture de service, quittance), renvoie une seule entrée dans "items" avec ce montant. Ignore les lignes de sous-total, total, monnaie rendue et mode de paiement : ce ne sont pas des articles. Si une information est illisible ou absente, fais la meilleure estimation raisonnable plutôt que de laisser un champ vide ou d'inventer une catégorie hors liste.`;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mediaType, data: fileBase64 } },
              { text: prompt },
            ],
          },
        ],
        // Force une sortie JSON valide : plus fiable qu'un nettoyage manuel
        // de balises markdown sur un texte libre.
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      // 429 = quota gratuit journalier/minute dépassé — message dédié pour
      // que l'utilisateur comprenne que ce n'est pas un bug.
      const status = response.status === 429 ? 429 : 502;
      const message =
        status === 429
          ? "Quota IA gratuit atteint pour l'instant, réessayez dans quelques minutes."
          : "Le service IA a renvoyé une erreur.";
      return jsonResponse({ error: message }, status);
    }

    const data = await response.json();
    const textBlock = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed;
    try {
      parsed = JSON.parse(textBlock);
    } catch {
      console.error("JSON parse failed:", textBlock);
      return jsonResponse({ error: "Réponse IA illisible, merci de réessayer." }, 502);
    }

    return jsonResponse(parsed, 200);
  } catch (err) {
    console.error("scan-receipt error:", err);
    return jsonResponse({ error: "Erreur interne du scanner." }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
