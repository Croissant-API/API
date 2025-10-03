A noter que dans la dépendance `sqlite3` a une dépendance qui a une dépendance... qui contient @npmcli/move-file@1.1.2: This functionality has been moved to @npmcli/fs & npmlog@6.0.2: This package is no longer supported & rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported & are-we-there-yet@3.0.1: This package is no longer supported et pour finir : gauge@4.0.4: This package is no longer supported

Pour `jest` (à voir si ça a été résolu dans des version supp) le module inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful. + glob@7.2.3: Glob versions prior to v9 are no longer supported

Modification du eslint.config.mjs
- Ajout de globalIgnores(['dist']) -> Ignore les fichiers build désormais
- Unification de la configuration JS/TS 
- Changement de l’environnement global (browser to node : ESLint considère maintenant que le code s’exécute dans un environnement Node.js, pas navigateur. -> Supprime les avertissements sur l’utilisation d’objets globaux Node (__dirname, process, etc.).)
- Utilisation de js.configs.recommended au lieu de plugins: { js }, extends: ["js/recommended"]
- Ajout explicite de ecmaVersion: 'latest'

Modif du tsconfig.json
- Change module "node" (node10 - deprecated) to "node16" (same for `moduleResolution`)
- Remove `baseUrl` (And correct the `path` with add the relative baseUrl)

2025.10.03 - 7:13
start migration of query builder :
- From knex to ts-query-builder

Remove dotenv

Modification des commandes suivantes :
- A start:development : Démarre l'app avec la configuration development.env
- M start : Démarre l'app avec la configuration production.env
- M dev : Run ts-node l'app typescript avec le fichier de development
- M build : Ajout du contexte de build

-- Commande : "migrate:logs" exécute `database/migrate-logs.ts` qui n'est pas dans le repo, par sécurité je ne vais pas y toucher

Ajout du fichier de configuration lors des appels base de données `./src/config/db.ts`