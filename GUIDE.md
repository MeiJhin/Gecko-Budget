# 🦎 Gecko Budget — le guide pas à pas

Ce guide explique, sans jargon, tout ce qu'il faut faire à la main. Comptez **environ 30 minutes** la première fois. Tout est **gratuit**.

Vous allez créer **deux comptes de service** (un seul pour vous deux, pas un chacun) :

| Service | À quoi il sert |
|---|---|
| **Supabase** | Le « coffre » qui garde vos données et vérifie qui a le droit de les lire. |
| **Vercel** | L'hébergeur qui met l'appli en ligne à une adresse web. |

> **Pourquoi Vercel plutôt que Netlify ?** Les deux se valent. Vercel se branche directement sur votre dépôt GitHub : chaque fois que le code change, l'appli se met à jour toute seule, sans rien faire. Il n'y a qu'un réglage à faire, une seule fois.

---

## Étape 1 — Créer la base de données (Supabase)

1. Allez sur **https://supabase.com** et cliquez sur **Start your project**.
2. Créez un compte (le plus simple : **Continue with GitHub**, puisque vous avez déjà un compte GitHub).
3. Cliquez sur **New project** et remplissez :
   - **Name** : `gecko-budget`
   - **Database Password** : cliquez sur **Generate a password**, puis notez ce mot de passe quelque part (vous n'en aurez a priori jamais besoin, mais gardez-le).
   - **Region** : choisissez une région en Europe, par exemple **West EU (Paris)** ou **Central EU (Frankfurt)**.
   - Le plan doit être **Free**.
4. Cliquez sur **Create new project** et patientez 1 à 2 minutes.
5. Dans le menu de gauche, ouvrez **SQL Editor** (l'icône `>_`), puis **New query**.
6. Ouvrez le fichier [`supabase/schema.sql`](supabase/schema.sql) sur GitHub. Cliquez sur l'icône **Copy raw file** (deux petits carrés, en haut à droite du fichier) pour copier tout son contenu.
7. Collez-le dans la grande zone de texte de Supabase, puis cliquez sur **Run** en bas à droite.
   ✅ Il doit s'afficher **« Success. No rows returned »**. Si Supabase affiche une fenêtre d'avertissement (« destructive operation »), cliquez sur **Run this query** : le script ne supprime aucune donnée.
8. Récupérez les deux informations dont l'appli a besoin :
   - Cliquez sur le bouton **Connect** en haut de la page (ou allez dans **Project Settings → API Keys** et **Data API**).
   - Copiez l'**URL du projet** (elle ressemble à `https://abcdefghijkl.supabase.co`).
   - Copiez la **clé publique** : elle s'appelle **anon public** ou **publishable** (elle commence par `eyJ…` ou `sb_publishable_…`).
   - ⚠️ N'utilisez **jamais** la clé **service_role** ou **secret** : elle donne tous les droits.

Gardez ces deux valeurs sous la main (dans une note de votre téléphone, par exemple).

---

## Étape 2 — Mettre l'appli en ligne (Vercel)

1. Allez sur **https://vercel.com** et cliquez sur **Sign Up**.
2. Choisissez **Hobby** (gratuit, usage personnel), puis **Continue with GitHub**.
3. Une fois connecté, cliquez sur **Add New… → Project**.
4. Dans la liste **Import Git Repository**, trouvez **Gecko-Budget** et cliquez sur **Import**.
   *Si le dépôt n'apparaît pas* : cliquez sur **Adjust GitHub App Permissions** et autorisez Vercel à accéder au dépôt `Gecko-Budget`.
5. Sur l'écran de configuration :
   - **Framework Preset** : Vercel doit afficher **Vite** tout seul. Ne touchez à rien d'autre.
   - Ouvrez la section **Environment Variables** et ajoutez ces deux lignes :

     | Key (nom) | Value (valeur) |
     |---|---|
     | `VITE_SUPABASE_URL` | l'URL du projet copiée à l'étape 1 |
     | `VITE_SUPABASE_KEY` | la clé publique copiée à l'étape 1 |

6. Cliquez sur **Deploy** et patientez environ 1 minute. 🎉
7. Cliquez sur **Continue to Dashboard** : l'adresse de votre appli est affichée sous **Domains**. Elle ressemble à `https://gecko-budget-xxxx.vercel.app`.
   *Astuce* : dans **Settings → Domains**, vous pouvez la remplacer par une adresse plus simple, par exemple `gecko-budget-famille.vercel.app`, si elle est libre.

> **Vous avez oublié les variables ?** L'appli s'ouvre alors en « mode démo » : les données restent sur le téléphone et ne sont pas partagées. Ajoutez-les dans **Settings → Environment Variables**, puis allez dans **Deployments**, ouvrez le menu **⋯** du dernier déploiement et choisissez **Redeploy**.

---

## Étape 3 — Dire à Supabase où vit l'appli

C'est indispensable pour que les e-mails (confirmation du compte, mot de passe oublié) renvoient vers votre appli.

1. Dans Supabase, ouvrez **Authentication → URL Configuration**.
2. **Site URL** : collez l'adresse de votre appli (par exemple `https://gecko-budget-xxxx.vercel.app`), puis cliquez sur **Save**.
3. **Redirect URLs** : cliquez sur **Add URL**, collez la même adresse, puis **Save URLs**.

---

## Étape 4 — Créer vos deux comptes et les relier au même foyer

Chacun a **son propre compte** (son e-mail et son mot de passe), mais vous partagez **un seul foyer** : tout ce que l'un note apparaît chez l'autre.

**Sur le premier téléphone** (le vôtre, par exemple) :

1. Ouvrez l'adresse de l'appli dans **Safari** (iPhone) ou **Chrome** (Android).
2. Touchez **Créer un compte**, puis saisissez votre e-mail et un mot de passe (8 caractères minimum).
3. Ouvrez l'e-mail « Confirm your signup » et touchez le lien. *L'e-mail peut mettre quelques minutes à arriver : pensez à regarder dans les spams.*
4. Revenez sur l'appli, puis touchez **Se connecter**.
5. Touchez **Créer notre foyer**.
6. Le message **« Bienvenue sur Gecko Budget 🦎 »** vous invite à remplir les réglages : prénoms, revenus, charges fixes, enveloppes et cagnottes. Touchez **Enregistrer**.
7. Rouvrez les réglages (⚙️ en haut à droite) : dans la rubrique **Notre foyer**, un **code de 6 caractères** s'affiche, par exemple `K7M2QX`.

**Sur le second téléphone** (celui de votre femme) :

1. Ouvrez la même adresse et touchez **Créer un compte** avec *son* e-mail.
2. Confirmez l'e-mail, puis connectez-vous.
3. Dans **J'ai un code**, tapez le code du premier téléphone, puis touchez **Rejoindre le foyer**.

C'est fait : le foyer est maintenant **fermé**, personne d'autre ne peut le rejoindre. Faites l'essai : ajoutez une dépense sur un téléphone, elle apparaît sur l'autre en une seconde.

> **Le second téléphone a créé un foyer par erreur ?** Ouvrez ⚙️ → **Notre foyer** → **Vous avez plutôt un code pour rejoindre l'autre foyer ?** (possible tant que ce foyer est vide).

---

## Étape 5 — Installer l'appli sur l'écran d'accueil

### Sur iPhone

1. Ouvrez l'adresse de l'appli dans **Safari**. Ça ne marche pas depuis Chrome ni depuis l'aperçu d'un lien dans une autre appli.
2. Touchez le bouton **Partager** : le carré avec une flèche vers le haut, en bas de l'écran (ou dans le menu **⋯** selon la version d'iOS).
3. Faites défiler et touchez **Sur l'écran d'accueil**.
4. Le nom « Gecko Budget » est déjà rempli : touchez **Ajouter**.
5. Ouvrez l'appli **depuis la nouvelle icône 🦎** et **connectez-vous une dernière fois**. Sur iPhone, l'appli installée a sa propre mémoire, séparée de Safari.

### Sur Android

1. Ouvrez l'adresse de l'appli dans **Chrome**.
2. Touchez le menu **⋮** en haut à droite.
3. Touchez **Ajouter à l'écran d'accueil**, puis **Installer** (Chrome propose parfois directement « Installer l'application » en bas de l'écran).
4. Ouvrez l'appli depuis la nouvelle icône. Si on vous le demande, reconnectez-vous.

L'appli s'ouvre alors en plein écran, comme une vraie appli, avec l'icône du gecko.

---

## Au quotidien

- **Noter une dépense** : touchez le gros **+** orange, tapez le montant, choisissez l'enveloppe, puis touchez **Ajouter**. Le dernier prénom choisi est retenu sur chaque téléphone.
- **Corriger ou supprimer** : touchez l'opération dans une liste.
- **Sans réseau** (métro, cave, campagne) : notez vos dépenses normalement. L'appli affiche « Hors connexion », garde tout sur le téléphone et l'envoie dès que le réseau revient.
- **Changer un budget** : ⚙️ → modifiez le montant → **Enregistrer**. Le nouveau montant s'applique à partir du mois en cours, les mois passés ne changent pas.
- **Thème clair ou sombre** : ⚙️ → **Apparence**. En mode « Auto », l'appli suit le réglage du téléphone.

---

## Export CSV et sauvegarde

Dans ⚙️ → **Export et sauvegarde** :

- **📄 Export CSV** : un fichier tableur avec toutes vos opérations (dépenses, rentrées, épargne), lisible dans Excel, Numbers ou Google Sheets.
- **💾 Sauvegarde** : un fichier `.json` qui contient **tout** (réglages + opérations).
- **♻️ Restaurer une sauvegarde** : recharge un fichier `.json`. Les opérations sont ajoutées ou remises à jour, sans créer de doublons.

Sur téléphone, le bouton ouvre le menu de partage : choisissez **Enregistrer dans Fichiers** (iPhone), **Drive**, ou envoyez-le-vous par e-mail.

**Notre conseil** : la formule gratuite de Supabase ne fait **pas** de sauvegarde automatique que vous pourriez récupérer vous-mêmes. Prenez l'habitude de toucher **💾 Sauvegarde** **une fois par mois, lors de votre point mensuel**, et rangez le fichier dans un dossier « Gecko Budget » sur iCloud Drive ou Google Drive. Ça prend 10 secondes.

---

## Bon à savoir

- **Supabase met en pause** les projets gratuits restés **7 jours sans aucune activité**. Si vous utilisez l'appli tous les jours, ça n'arrivera pas. Si c'est le cas après des vacances, connectez-vous sur supabase.com et cliquez sur **Restore project** : vos données sont intactes.
- **Les e-mails de Supabase** (confirmation, mot de passe oublié) sont limités à quelques-uns par heure sur la formule gratuite. Si un e-mail n'arrive pas, attendez un peu avant de réessayer.
- *(Facultatif)* Pour éviter l'e-mail de confirmation, allez dans Supabase → **Authentication → Sign In / Providers → Email** et décochez **Confirm email**. N'importe qui pourrait alors créer un compte sur votre appli, mais il ne verrait **rien** de vos données : elles sont protégées par les règles du foyer.
- **Mises à jour** : quand le code change sur GitHub, Vercel remet l'appli en ligne tout seul. Les téléphones prennent la nouvelle version à l'ouverture suivante de l'appli.
- **Mot de passe oublié** : sur l'écran de connexion, touchez **Mot de passe oublié ?**. Le lien reçu par e-mail ouvre l'appli dans le navigateur pour choisir un nouveau mot de passe. Reconnectez-vous ensuite depuis l'icône.

## En cas de souci

| Ce que vous voyez | Que faire |
|---|---|
| « Mode démo » dans les réglages, ou rien n'est partagé | Les variables Vercel manquent : refaites l'étape 2.5, puis **Redeploy**. |
| « E-mail ou mot de passe incorrect » | Vérifiez l'e-mail, ou utilisez **Mot de passe oublié ?**. |
| « Confirmez d'abord votre adresse » | Cliquez sur le lien de l'e-mail de confirmation (regardez dans les spams). |
| Le lien de l'e-mail mène à une page d'erreur | Refaites l'étape 3 (Site URL). |
| « Code inconnu » | Le code se lit dans ⚙️ → Notre foyer, sur le **premier** téléphone. |
| Une opération ne s'affiche pas chez l'autre | Fermez complètement l'appli, puis rouvrez-la : elle recharge tout à l'ouverture. |
