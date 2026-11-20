# 🦎 Gecko Budget

Une appli de budget pour notre couple : on note chaque dépense en quelques secondes, et on voit tout de suite où on en est dans le mois.

<p align="center"><img src="assets/gecko-budget-icon.svg" width="120" alt="Icône Gecko Budget"></p>

- **Installation et mise en ligne** : suivez le [guide pas à pas](GUIDE.md).
- Appli web installable sur iPhone et Android (PWA), en français, avec un thème clair et un thème sombre.
- Données partagées en temps réel entre les deux téléphones grâce à Supabase, protégées par des règles RLS (un seul foyer, 2 comptes au maximum).
- La saisie fonctionne hors connexion : les opérations sont envoyées dès que le réseau revient.

## Comment c'est construit

| Partie | Outil |
|---|---|
| Interface | React + TypeScript, compilé avec Vite |
| Appli installable, hors connexion | vite-plugin-pwa (service worker + manifeste) |
| Base de données, comptes, temps réel | Supabase (`supabase/schema.sql`) |
| Hébergement | Vercel (déploiement automatique depuis GitHub) |
| Polices | Bricolage Grotesque et Plus Jakarta Sans, incluses dans l'appli |

```
src/lib/calc.ts       tous les calculs (reste à dépenser, rythme, bilan, épargne, charges)
src/lib/store.ts      cache local, file d'attente hors connexion, synchro temps réel
src/lib/settings.ts   réglages et versions du budget (un changement vaut à partir du mois en cours)
src/screens/          Suivi, Dépenses, Épargne, Bilan (+ Charges fixes), connexion
src/components/       panneau d'ajout, réglages, sélecteur d'icône, graphiques
supabase/schema.sql   tables, règles de sécurité, création / adhésion au foyer
scripts/render-svg.cjs + make-icons.py : toutes les icônes depuis assets/gecko-budget-icon.svg
```

## Pour les développeurs

```bash
npm install
npm run dev        # sans .env.local : « mode démo », données dans le navigateur
npm test           # tests des calculs, des réglages et de l'export
npm run build && npx vite preview --port 4173
node tests/e2e.mjs # test de bout en bout dans Chromium (Playwright)
```

Pour brancher Supabase en local, copiez `.env.example` en `.env.local` et remplissez les deux valeurs.
