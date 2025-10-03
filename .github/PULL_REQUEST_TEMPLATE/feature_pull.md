# ✨ Feature - [Nom explicite de la fonctionnalité]
## 📌 Référence à l’issue
Closes #[numéro de l’issue]  
*(ou : Fixes #123 / Resolves #123)*

## 🧠 Contexte & Objectif
Décris ici :
- **Pourquoi** cette fonctionnalité est nécessaire
- Le **besoin utilisateur** ou le **contexte fonctionnel** concerné
- Un rappel de ce que cette feature doit accomplir

> Exemple :  
> Permettre aux utilisateurs de générer leur **Kiff Score** personnalisé via la commande `/kiff`, basé sur leur historique d’interactions.

## ⚙️ Détail de l’implémentation
Explique les **décisions techniques** prises pour implémenter la feature :
- Nouveaux fichiers / modules créés
- Nouvelles commandes, events, services, ou helpers
- Comportements conditionnels / paramètres
- Points d’attention éventuels

> Exemple :  
> - Création du fichier `kiff-score.ts` dans `src/commands/`  
> - Utilisation du service `user.service.ts` pour récupérer les données  
> - Ajout d’un embed Discord pour afficher le score de façon stylisée

## 🔍 Tests réalisés
- [ ] Fonction testée en local via Discord
- [ ] Données edge-case couvertes
- [ ] Linter passé (`npm run lint`)
- [ ] Tests unitaires ajoutés (si applicable)
- [ ] Aucun test cassé (`npm run test`)

## 📸 Aperçu / Démo (si applicable)
> Ajouter ici des captures d’écran, gifs ou logs pertinents montrant la fonctionnalité en action.  
> *(Facultatif mais recommandé pour tout ce qui est interactif ou visuel)*

## 🧼 Checklist de conformité
- [ ] Nom de branche respecté (`feature/nom-de-la-feature`)
- [ ] Commit(s) propres, explicites, avec [gitmoji](https://gitmoji.dev/)
- [ ] Code typé, clair et aligné avec les conventions du projet
- [ ] Aucun `console.log` ou TODO résiduel inutile
- [ ] Comportement testé avec succès sur au moins **2 scénarios** différents

## ⏭️ Prochaines étapes
- [ ] Ajout de documentation technique (dans `/DOCS/`)
- [ ] Prévoir un feedback UI/UX (si visuel)
- [ ] Synchroniser avec d’autres features liées
- [ ] Ajouter cette commande dans `/help` ou autre index global

> Merci pour ta contribution 💪  
> Une relecture sera faite par un membre du core team avant merge dans `develop`.