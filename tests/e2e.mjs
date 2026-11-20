// Test de bout en bout en mode démo : node tests/e2e.mjs  (serveur sur http://localhost:4173)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const NB = ' ';
let ok = 0;
const check = (cond, label) => {
  if (!cond) throw new Error('ÉCHEC : ' + label);
  ok++;
  console.log('✓ ' + label);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL);

const hero = () => page.locator('.hero .big').innerText();
const sheet = page.locator('.sheet');
const keys = async (s) => {
  for (const k of s) await sheet.locator('.keypad').getByRole('button', { name: k === ',' ? 'Virgule' : k, exact: true }).click();
};
const clearAmount = async () => {
  for (let i = 0; i < 8; i++) await sheet.getByRole('button', { name: 'Effacer' }).click();
};
const closed = () => page.waitForSelector('.sheet', { state: 'detached' });
const nav = (name) => page.locator('.nav').getByText(name, { exact: true }).click();

check((await page.getByText('Bienvenue sur Gecko Budget 🦎').count()) === 1, "message d'accueil au premier lancement");

// --- réglages
await page.getByText('Remplir nos réglages').click();
await sheet.getByLabel('Revenus du foyer par mois').fill('3800');
await sheet.getByLabel('Budget mensuel Courses').fill('200');
await sheet.getByLabel('Budget mensuel Restos & sorties').fill('100');
await sheet.getByText('+ Ajouter une charge fixe').click();
await sheet.getByLabel('Nom de la charge').fill('Loyer');
await sheet.getByLabel('Montant par mois').fill('950');
await sheet.getByLabel('Jour du prélèvement').fill('5');
check((await sheet.locator('.setrow .icobtn').first().innerText()) === '🏠', 'icône devinée : Loyer → 🏠');
await sheet.getByRole('button', { name: 'Enregistrer' }).click();
await closed();
check((await page.getByText('Bienvenue sur Gecko Budget').count()) === 0, "l'accueil disparaît une fois les réglages faits");
check((await hero()) === `300${NB}€`, 'reste ce mois-ci = 300 € (200 + 100 d’enveloppes)');

// --- dépense : erreurs, ajout
await page.locator('.nav .plus').click();
await sheet.getByRole('button', { name: 'Ajouter' }).click();
check((await sheet.getByRole('alert').innerText()).includes('montant'), 'erreur si montant manquant');
await keys('128,3');
check((await sheet.locator('.big-amount').innerText()).startsWith('128,3'), 'le pavé numérique affiche 128,3');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
check((await sheet.getByRole('alert').innerText()).includes('enveloppe'), 'erreur si enveloppe non choisie');
await sheet.getByRole('radio', { name: 'Courses' }).click();
await sheet.getByLabel('Note').fill('Leclerc');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
await closed();
check((await hero()) === `172${NB}€`, 'après 128,30 € : il reste 172 €');
const tile = page.locator('.tile', { hasText: 'Courses' });
check((await tile.locator('.left').innerText()) === `72${NB}€`, 'enveloppe Courses : 72 € restants');

// --- modification
await page.locator('.txrow', { hasText: 'Leclerc' }).click();
check((await sheet.locator('h2').innerText()) === 'Modifier la dépense', 'toucher une opération rouvre le panneau');
await clearAmount();
await keys('250');
await sheet.getByRole('button', { name: 'Enregistrer' }).click();
await closed();
check((await tile.locator('.left').innerText()) === `−50${NB}€`, 'dépassement affiché en négatif');
check((await tile.getAttribute('class')).includes('over'), 'tuile dépassée avec contour rouge');
check((await tile.locator('.badge').innerText()) === 'Dépassé', 'étiquette Dépassé');
check((await page.locator('.mood').innerText()).includes('Budget dépassé') || (await page.locator('.mood').innerText()).includes('vite'), 'pastille de rythme mise à jour');

// --- suppression
await page.locator('.txrow', { hasText: 'Leclerc' }).click();
await sheet.getByRole('button', { name: 'Supprimer' }).click();
await sheet.getByRole('button', { name: 'Vraiment supprimer ?' }).click();
await closed();
check((await hero()) === `300${NB}€`, 'après suppression : retour à 300 €');

// --- rentrée
await page.locator('.nav .plus').click();
await sheet.getByRole('tab', { name: '💰 Rentrée' }).click();
await keys('40');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
check((await sheet.getByRole('alert').innerText()).includes("d'où vient"), 'erreur si type de rentrée non choisi');
await sheet.getByRole('radio', { name: 'Vente Vinted/Leboncoin' }).click();
await sheet.getByRole('radio', { name: 'Ma femme' }).click();
await sheet.getByRole('button', { name: 'Ajouter' }).click();
await closed();
check((await hero()) === `300${NB}€`, 'une rentrée ne recharge pas les enveloppes');
await page.locator('.banner-income').click();
check((await page.locator('.chip.on').innerText()).includes('Rentrées'), 'le bandeau ouvre Dépenses filtré sur les rentrées');
check((await page.locator('.txrow .amt').first().innerText()) === `+40,00${NB}€`, 'rentrée en vert avec +');
// modifier la rentrée
await page.locator('.txrow').first().click();
await clearAmount();
await keys('45');
await sheet.getByRole('button', { name: 'Enregistrer' }).click();
await closed();
check((await page.locator('.stat .v').nth(1).innerText()) === `+45${NB}€`, 'rentrée modifiée : +45 €');

// --- épargne
await nav('Épargne');
await page.getByText('＋ Mettre de côté').click();
await keys('100');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
await closed();
check((await page.locator('.savehero .big').innerText()) === `100${NB}€`, 'versement : épargne = 100 €');
await page.getByText('− Retirer').click();
await keys('30');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
check((await sheet.getByRole('alert').innerText()).includes('pourquoi'), 'raison obligatoire pour un retrait');
await sheet.getByLabel('Pourquoi ? *').fill('Cadeau anniversaire');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
await closed();
check((await page.locator('.savehero .big').innerText()) === `70${NB}€`, 'retrait : épargne = 70 €');
check((await page.locator('.txrow', { hasText: 'Cadeau anniversaire' }).locator('.amt').innerText()) === `−30,00${NB}€`, 'retrait affiché avec − et sa raison');
await page.getByText('− Retirer').click();
await keys('500');
await sheet.getByLabel('Pourquoi ? *').fill('Test');
await sheet.getByRole('button', { name: 'Ajouter' }).click();
check((await sheet.getByRole('alert').innerText()).includes("Il n'y a que 70,00"), "impossible de retirer plus que le solde");
await sheet.getByLabel('Fermer').click();
await closed();
// supprimer le retrait
await page.locator('.txrow', { hasText: 'Cadeau anniversaire' }).click();
await sheet.getByRole('button', { name: 'Supprimer' }).click();
await sheet.getByRole('button', { name: 'Vraiment supprimer ?' }).click();
await closed();
check((await page.locator('.savehero .big').innerText()) === `100${NB}€`, 'retrait supprimé : retour à 100 €');

// --- bilan
await nav('Bilan');
const save = await page.locator('.savecard .v').innerText();
// 3800 + 45 − 950 − 300 = 2595
check(save === `2${NB}595${NB}€`, 'bilan 1 mois : 3 800 + 45 − 950 − 300 = 2 595 €');
check((await page.locator('.savecard').innerText()).includes(`versé en épargne : 100${NB}€`), 'bilan : versé en épargne 100 €');
await page.getByRole('tab', { name: 'Charges fixes' }).click();
check((await page.getByText('le 5 du mois').count()) === 1 && (await page.getByText('✓ Prélevé').count()) === 1, 'charge du 5 marquée Prélevé le 20');

// --- anglais
await page.getByLabel('Réglages').click();
await sheet.getByRole('button', { name: '🇬🇧 English' }).click();
check((await sheet.locator('h2').innerText()) === 'Our budget', 'réglages traduits en anglais');
await sheet.getByLabel('Close').click();
await closed();
check((await page.locator('.nav').innerText()).includes('Spending'), 'barre de navigation en anglais');
await page.getByRole('tab', { name: 'Report' }).click();
check((await page.locator('.savecard .v').innerText()) === '€2,595', 'montants au format anglais : €2,595');
await page.reload();
check((await page.locator('.nav').innerText()).includes('Report'), 'la langue est retenue après rechargement');
await page.getByLabel('Settings').click();
await sheet.getByRole('button', { name: '🇫🇷 Français' }).click();
await sheet.getByLabel('Fermer').click();
await closed();

// --- persistance
await page.reload();
await nav('Bilan');
check((await page.locator('.savecard .v').innerText()) === `2${NB}595${NB}€`, 'les données sont toujours là après rechargement');

check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
console.log(`\n${ok} vérifications réussies`);
await browser.close();
