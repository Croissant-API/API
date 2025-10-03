# 🛠️ CONTRIBUTING.md
Merci de vouloir contribuer à **Croisant-API - API** !
Ce document définit les bonnes pratiques de développement pour garantir un code robuste, lisible et maintenable.

## 🧠 Préambule
Tout développement doit :
* Être basé sur une *issue* claire (feature, bug, amélioration)
* Suivre le **GitFlow simplifié** du projet
* Respecter les conventions de code définies dans ce document

## 🔧 Stack et Contexte
* **Environnement** : Node.js + Express
* **Langage** : TypeScript
* **Base de données** : MYSQL
* **Tests** : Jest
* **Linting** : ESLint + Prettier
* **Convention de commits** : [Gitmoji](https://gitmoji.dev/) ou [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
* **Workflow Git** : GitFlow simplifié (voir ci-dessous)

## 📁 Structure du projet
L'API est structurée de manière modulaire :

```
/src
  /config
  /controllers
  /middlewares
  /models
  /routers
  /services
  /types
  /utils
```

Merci de respecter cette architecture lors de l'ajout ou la modification de code.

## 📦 Installation du projet
Avant de commencer le développement :

```bash
pnpm install
```

Crée aussi un fichier `development.env` pour le développement (voir `.env.example` pour le format).
Sinon créer un fichier `production.env` (voir `.env.example` pour le format).

## 🗂️ Branching Strategy
### 🔧 Types de branches
| Type     | Préfixe     | Description                         | Base      | Destination |
| -------- | ----------- | ----------------------------------- | --------- | ----------- |
| Feature  | `feature/`  | Nouvelle fonctionnalité             | `develop` | `develop`   |
| Fix      | `fix/`      | Correction non urgente              | `develop` | `develop`   |
| Hotfix   | `hotfix/`   | Correction urgente en production    | `main`    | `main`      |
| Refactor | `refactor/` | Refonte sans changement fonctionnel | `develop` | `develop`   |
| Chore    | `chore/`    | Tâches techniques ou de maintenance | `develop` | `develop`   |

### 🧾 Convention de nommage
```bash
<type>/<issue-id>-<slug>
```

Exemples :
* `feature/123-user-authentication`
* `fix/234-crash-on-empty-request`

## 🔄 Cycle complet d'une contribution
### 1. 📌 Créer une issue
* Décrire le contexte, le besoin et les critères d'acceptation
* Taguer avec le bon label (`feature`, `bug`, `enhancement`, etc.)

### 2. 🌱 Créer une branche
```bash
git checkout develop
git pull
git checkout -b feature/123-user-authentication
```

### 3. 💻 Développement
* Respecter la structure du projet
* Typage strict avec TypeScript
* Aucun `console.log` dans les commits finaux
* Utiliser des commits clairs et Gitmoji-compliants :

```bash
git commit -m ":sparkles: Ajout de l'authentification utilisateur"
```

#### Gitmojis fréquents :
| Emoji | Code          | Description                 |
| ----- | ------------- | --------------------------- |
| ✨     | `:sparkles:`  | Nouvelle fonctionnalité     |
| 🐛    | `:bug:`       | Correction de bug           |
| ♻️    | `:recycle:`   | Refactoring                 |
| 🔥    | `:fire:`      | Suppression de code inutile |
| 🧪    | `:test_tube:` | Ajout ou MAJ de tests       |
| 📝    | `:memo:`      | MAJ de documentation        |

### 4. ⬆️ Push & Pull Request
```bash
git push origin feature/123-user-authentication
```

* Créer une **PR vers `develop`**
* Utiliser un template (si disponible)
* Vérifier que les tests passent, le linter aussi

### 5. 🔍 Code Review
* Min. 1 relecture (core team)
* Points vérifiés :
  * Lisibilité du code
  * Respect de la structure
  * Typage TypeScript
  * Couverture de test
  * Pas de console.log / code mort
  * Commit messages clairs

## ✅ Tests & Vérifications
Avant de créer une **pull request**, merci de :

1. Vérifier que l'app se build :
   ```bash
   pnpm build
   ```
2. Lancer les tests :
   ```bash
   pnpm test
   ```
3. Vérifier le linter :
   ```bash
   pnpm lint
   ```
4. Vérifier que le code fonctionne en local :
   ```bash
   pnpm dev
   ```

## 🎯 Releases & Versioning
### 📦 Semantic Versioning (SemVer)
```
MAJOR.MINOR.PATCH[-label]
```

| Type  | Cas d'usage                       |
| ----- | --------------------------------- |
| MAJOR | Changement cassant                |
| MINOR | Nouvelle feature rétro-compatible |
| PATCH | Fix / amélioration mineure        |

Labels pré-release :
* `-alpha`, `-beta`, `-rc.X`

### 🛠️ Processus de release
1. Merger les PRs dans `develop`
2. Release :
```bash
git checkout main
git pull
git merge develop
git tag -a v1.5.0 -m "Release v1.5.0"
git push origin main --tags
```

3. CI déclenche le déploiement
4. Synchroniser `develop` si hotfix :

```bash
git checkout develop
git pull origin main
```

## 🧪 Checklist post-merge
* [ ] Build OK (`pnpm build`)
* [ ] Tests passent (`pnpm test`)
* [ ] Lint propre (`pnpm lint`)
* [ ] Fonctionne en local (`pnpm dev`)
* [ ] Changelog mis à jour (si applicable)
* [ ] Issue associée **clôturée**

## 📝 Pull Request propre
Une PR valide doit :
* Utiliser un titre clair
* Avoir une description explicite
* Référencer l'issue concernée
* Avoir des tests (si logique complexe)
* Être validée par un core reviewer

## 🧹 Normes de code
* Utiliser des fonctions pures & services isolés
* Gestion d'erreurs propre (`try/catch`, logs)
* Éviter les abréviations non standards
* Ne **jamais** hardcoder de valeurs sensibles
* Typage strict (params, retour, erreurs)

## 🙏 Merci !
Merci de contribuer à **Croissant-API - API** !
Votre rigueur garantit la stabilité, la qualité et l'évolutivité de l'api de la plateforme.

Pour toute question, n'hésitez pas à ouvrir une *issue* ou contacter l'équipe core.