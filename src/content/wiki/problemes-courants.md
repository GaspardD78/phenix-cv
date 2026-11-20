---
id: problemes-courants
title: Problèmes courants
group: Aide
order: 17
---

## L'export PDF ne fonctionne pas

L'application essaie plusieurs moteurs dans cet ordre : WebView2 (un composant de Windows, généralement déjà installé avec Microsoft Edge), puis Microsoft Edge, puis Google Chrome. Si aucun ne répond, elle ouvre l'impression de Windows : choisissez « Enregistrer au format PDF ».

Si le message d'erreur vous est proposé, copiez-le : vous le retrouverez dans **Paramètres**, rubrique **Options avancées**, avec le bouton **Copier les détails du dernier export**.

## Windows bloque l'installation

Windows peut afficher « Windows a protégé votre ordinateur » lors de l'installation de l'application. Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**. Téléchargez l'application uniquement depuis la source qui vous l'a remise.

## WebView2 manque

WebView2 est un composant de Windows utilisé pour l'affichage et l'export PDF. Il est en général déjà présent, surtout si Microsoft Edge est installé. S'il manque, l'application passe à Edge ou à Chrome. Pour l'installer, téléchargez « WebView2 Runtime » sur le site officiel de Microsoft.

## Mon CV dépasse une page

L'éditeur vous le signale. Rien n'est perdu : le PDF continue simplement sur une deuxième page, numérotée (« 1 / 2 », « 2 / 2 »), avec des marges en haut et en bas et, pour les modèles à bande latérale, la bande sur toute la hauteur. Si vous préférez une seule page, cliquez sur « Ajuster à 1 page » ou retirez les expériences proposées en priorité. Vous pouvez aussi choisir une forme de date plus courte, ou raccourcir des puces. Voir [Mise en page et formats de dates](/aide/mise-en-page-dates).

## Je ne retrouve pas mes données

Vos données sont dans l'application sur cet ordinateur. Si vous avez changé d'ordinateur, restaurez votre fichier de sauvegarde (voir [Sauvegarder et restaurer](/aide/sauvegarder)).

## Une réponse de l'IA n'est pas reconnue

Vérifiez que vous avez copié la réponse complète, jusqu'à sa fin. Si elle est coupée, demandez à l'IA : « Continue ». Si l'IA a ajouté du texte autour, ce n'est pas un problème : l'application le lit quand même.
