---
id: version-portable
title: Utiliser Phénix CV sans installation (clé USB)
group: Aide
order: 17.5
---

## À quoi ça sert

La version portable de Phénix CV ne s'installe pas. Vous copiez un dossier sur une clé USB (ou ailleurs) et vous double-cliquez sur l'application. Toutes vos données restent dans ce dossier : vous les emportez avec vous, et vous ne laissez rien sur l'ordinateur qui vous prête sa prise USB.

C'est pratique pour travailler sur votre CV depuis un ordinateur partagé, à la médiathèque ou chez un proche.

## Comment faire

1. Récupérez le dossier **Phenix-CV-portable** (une archive ZIP à décompresser).
2. Copiez-le sur votre clé USB, ou n'importe où sur un ordinateur Windows.
3. Ouvrez le dossier et double-cliquez sur **Phenix-CV.exe**.
4. Utilisez Phénix CV comme d'habitude. Vos données sont enregistrées dans le sous-dossier **data**, à côté de l'application.
5. Quand vous avez fini, fermez Phénix CV **avant** de retirer la clé.

Pour changer d'ordinateur ou faire une copie, copiez le dossier **en entier**, « data » compris.

Dans **Paramètres**, rubrique **Mes données**, une carte vous rappelle où sont vos données et vous permet d'ouvrir le dossier.

## Ce qui est dans le dossier « data »

- votre profil, vos CV et vos candidatures ;
- les copies de sécurité automatiques faites avant une restauration ou un import (dossier « sauvegardes-automatiques ») ;
- les données internes de l'application.

Le fichier **.portable**, à côté de l'application, active ce mode. Ne le supprimez pas : sans lui, l'application enregistrerait vos données sur l'ordinateur, pas sur la clé.

## Si Windows indique qu'un composant manque

- **WebView2** : installez « Microsoft Edge WebView2 Runtime », gratuit, fourni par Microsoft. Il est déjà présent sur Windows 11 et sur la plupart des Windows 10 à jour.
- **VCRUNTIME140.dll** : installez « Microsoft Visual C++ Redistributable », gratuit, fourni par Microsoft.

## Si l'application dit que « data » n'est pas utilisable

La clé est peut-être protégée en écriture, ou le dossier se trouve dans un endroit où Windows interdit d'écrire (par exemple « Program Files »). L'application utilise alors les dossiers de l'ordinateur, et vous le signale dans **Mes données**. Déplacez le dossier sur votre clé ou dans vos documents, puis relancez l'application.

## Ce qu'un recruteur cherche

Rien : la version portable ne change pas votre CV. Elle change seulement l'endroit où vit votre travail.

## Exemples

- **Bonne pratique** : Camille Martin garde Phénix CV sur sa clé USB, modifie son CV à la médiathèque, ferme l'application, puis retire la clé. Rien ne reste sur l'ordinateur de la médiathèque.
- **Mauvaise pratique** : arracher la clé alors que l'application est ouverte : les dernières modifications peuvent être perdues.

## Erreurs à éviter

- Ne copier que « Phenix-CV.exe » sans le dossier « data » : vous perdriez vos données.
- Supprimer le fichier « .portable ».
- Garder la seule copie de vos données sur la clé : une clé se perd ou tombe en panne. Faites aussi une sauvegarde sur votre ordinateur (voir [Sauvegarder et restaurer](/aide/sauvegarder)).
