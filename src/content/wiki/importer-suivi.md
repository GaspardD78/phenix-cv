---
id: importer-suivi
title: Importer mon suivi depuis Excel
group: Suivi
order: 14.5
---

## À quoi ça sert

Vous suiviez vos candidatures dans un tableau (Excel, Google Sheets, LibreOffice) ? Phénix CV les reprend dans son suivi, sans tout ressaisir. Vous voyez un aperçu avant l'import, rien n'est enregistré avant votre accord, et vous pouvez annuler l'import juste après.

## Comment faire

1. Ouvrez **Candidatures**, puis cliquez sur **Importer**.
2. Donnez votre tableau, au choix :
   - **Collez-le** : dans votre tableur, sélectionnez les cellules, titres compris, copiez-les (Ctrl+C), puis collez-les dans la zone prévue (Ctrl+V). Cela marche avec Excel, Google Sheets et LibreOffice.
   - **Choisissez un fichier** Excel (`.xlsx`) ou `.csv`. Si votre classeur a plusieurs feuilles, choisissez celle à importer.
3. Choisissez comment ranger votre tableau :
   - **Importer avec l'IA** (conseillé) : choisissez les colonnes à confier à l'IA, copiez le texte préparé, collez-le dans l'IA de votre choix (ChatGPT, Claude, Gemini…), puis recollez sa réponse. Un grand tableau est découpé en plusieurs parties.
   - **Importer sans IA** : indiquez à quoi correspond chaque colonne (des propositions sont faites d'après vos titres), puis dans quelle colonne du suivi ranger chacun de vos statuts.
4. Vérifiez l'aperçu : lignes prêtes, lignes en erreur, doublons possibles et points à vérifier. Puis cliquez sur **Importer**.
5. Après l'import, un bandeau en haut du suivi propose **Annuler cet import** : les candidatures ajoutées sont retirées, celles qui ont été complétées redeviennent comme avant. Quand tout vous convient, cliquez sur **Garder cet import**.

## Vos coordonnées et l'IA

Les colonnes qui semblent contenir des coordonnées (e-mail, téléphone, nom d'une personne) ne sont pas envoyées à l'IA : elles sont décochées au départ. Vous pouvez quand même les importer : elles sont alors lues sur votre ordinateur, ligne par ligne, sans passer par l'IA.

La réponse de l'IA est contrôlée : une valeur absente de votre tableau est écartée, une ligne inventée est refusée, une ligne oubliée est signalée.

## Ce qui est adapté

- **Les dates** : « 12/03/2026 » se lit jour/mois/année. Sans IA, si votre tableau est au format américain, choisissez-le à l'étape des colonnes. Les dates d'un fichier `.xlsx` sont lues telles quelles. Une date sans jour (« mars 2026 ») est datée du 1er du mois et signalée comme approximative.
- **Les statuts** : « Envoyé », « Relancé », « Entretien », « Refus »… vont dans la bonne colonne du suivi. Un statut non reconnu va dans **Brouillon** et il est signalé : vous pouvez le changer.
- **Les doublons** : une candidature à la même entreprise, pour le même poste, à quelques jours près, est signalée. Choisissez **Ignorer**, **Fusionner (compléter les champs vides)** ou **Ajouter quand même**.
- **Les grands tableaux** : jusqu'à 2000 lignes à la fois. Au-delà, importez votre tableau en plusieurs fois.

## Ce qui n'est pas lu directement

- **Un ancien fichier Excel (`.xls`)** ou un classeur protégé par un mot de passe : dans Excel, enregistrez-le au format `.xlsx` sans mot de passe, ou copiez-collez les cellules.
- **Un fichier LibreOffice (`.ods`)** : copiez-collez les cellules, ou enregistrez-le au format `.xlsx` ou `.csv`.
- **Les couleurs, commentaires et mises en forme** de votre tableau : seules les valeurs sont reprises.

Avant l'import, Phénix CV enregistre automatiquement une copie de vos données : voir [Sauvegarder et restaurer](/aide/sauvegarder).

## Ce qu'un recruteur cherche

Rien de ce suivi : il vous sert à vous organiser. Reprendre votre historique vous évite surtout de postuler deux fois au même endroit, et de rater une relance.

## Exemples

- **Bonne pratique** : Camille Martin colle son tableau Excel « Entreprise, Poste, Statut, Date d'envoi », vérifie l'aperçu, choisit **Ignorer** pour un doublon, puis importe ses 40 candidatures.
- **Mauvaise pratique** : importer sans regarder l'aperçu, puis découvrir que des statuts inconnus sont tous restés en **Brouillon**.

## Erreurs à éviter

- Oublier la ligne des titres en copiant : les propositions de colonnes sont moins justes sans elle.
- Envoyer à l'IA une colonne de coordonnées alors qu'elle n'est pas utile : laissez-la décochée.
- Modifier les candidatures importées avant de les avoir vérifiées : si vous annulez ensuite l'import, ces modifications sont perdues avec lui. Seul le dernier import peut être annulé.
