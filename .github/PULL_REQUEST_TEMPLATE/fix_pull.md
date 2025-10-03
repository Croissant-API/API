# 🐛 Fix Bug - [Titre court et clair du bug]
## 📌 Référence à l’issue
Closes #[numéro de l’issue]  
*(ou : Fixes #123 / Resolves #123)*

## 🧠 Description du bug
Décris ici, de manière concise :
- Ce qui **ne fonctionnait pas**
- Dans **quel contexte** le bug survenait
- (Facultatif) Ce qui l’a potentiellement causé

> Exemple :  
> La commande `/kiff` retournait une erreur 500 lorsqu’un utilisateur non enregistré dans la base était mentionné.

## ✅ Correction apportée
Explique **comment** tu as corrigé le problème :
- Les **changements techniques clés**
- La **logique mise à jour**
- (Optionnel) Ajout de vérifications ou de fallback

> Exemple :  
> Ajout d’un check `if (!userExists)` dans `user.service.ts` avant d'appeler l'API externe.  
> Retour d’un message Discord clair : "Utilisateur non trouvé."

## 🔍 Étapes de reproduction (avant correction)
1. Tapez `/kiff @user`
2. L’utilisateur n’est pas enregistré
3. Une erreur 500 est renvoyée dans la console

## ✅ Étapes de validation (après correction)
1. Tapez `/kiff @user`
2. Si l’utilisateur n’est pas trouvé, un message Discord s’affiche
3. Aucune erreur dans la console

## 🔬 Tests
- [ ] Test unitaire ajouté ou mis à jour
- [ ] Testé en local avec plusieurs cas
- [ ] Aucun test automatique cassé (`npm run test`)
- [ ] Linter passé (`npm run lint`)

## 📸 Captures (si applicable)
> Ajoute ici une capture d’écran de la console, du message Discord, ou du comportement corrigé.  
*(Facultatif mais recommandé pour les bugs liés à l’affichage ou à l’interaction utilisateur)*

## 🧼 Checklist finale
- [ ] La PR ne contient **que la correction du bug**
- [ ] Les logs de debug (`console.log`) inutiles ont été supprimés
- [ ] Le code respecte les conventions (`camelCase`, typage, etc.)
- [ ] Cette PR est prête à être relue

> Merci de contribuer à rendre le bot plus stable 🙏  
> Une relecture rapide sera faite par un membre du core team.