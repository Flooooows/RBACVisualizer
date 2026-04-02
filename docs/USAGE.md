# RBAC Visualizer — Guide d’utilisation

Ce document explique à quoi sert l’application et comment utiliser chaque écran du MVP.

## 1. À quoi sert l’application

RBAC Visualizer aide à comprendre le **RBAC Kubernetes** à partir de manifests YAML/JSON.

L’objectif est de répondre rapidement à des questions comme :

- qui a accès à quoi ?
- via quel `RoleBinding` ou `ClusterRoleBinding` ?
- est-ce que l’accès est limité à un namespace ou cluster-wide ?
- quels sujets ont des permissions dangereuses ?
- quels rôles ou bindings paraissent cassés, trop permissifs, ou inutilisés ?

Le modèle suivi est strictement celui de Kubernetes :

- `Role`
- `ClusterRole`
- `RoleBinding`
- `ClusterRoleBinding`
- `User`
- `Group`
- `ServiceAccount`

## 2. Vue d’ensemble des écrans

L’application contient 6 écrans principaux dans la navigation :

- Dashboard
- Imports
- Graph
- Subjects
- Resources
- Anomalies

Chaque écran répond à un besoin différent.

---

## 3. Dashboard

### À quoi il sert

Le dashboard donne une vue rapide du dernier snapshot importé.

### Ce qu’on y trouve

- nombre de documents importés
- nombre de sujets
- nombre de bindings
- nombre de rôles
- nombre de findings/anomalies
- statut du snapshot courant

### Quand l’utiliser

Utilise-le pour vérifier rapidement :

- qu’un import s’est bien passé
- si le dataset contient déjà des findings intéressants
- si tu travailles bien sur le snapshot attendu

---

## 4. Imports

### À quoi il sert

C’est la porte d’entrée de l’application. On y charge les manifests RBAC Kubernetes.

### Ce que tu peux faire

- charger un exemple propre avec **Load clean sample**
- charger un exemple avec anomalies avec **Load anomaly sample**
- charger un fichier local YAML/JSON avec **Load file**
- lancer un import direct depuis un cluster avec **Import current cluster**
- modifier le contenu dans la zone texte
- donner un `sourceLabel`
- créer un snapshot avec **Create import snapshot**

### Ce que montre l’écran

- la liste des snapshots importés
- le statut de chaque snapshot
- le nombre de documents et findings
- le détail d’un snapshot sélectionné
- les warnings retournés par le backend

### Quand l’utiliser

Utilise-le :

- pour créer un nouveau snapshot
- pour vérifier si un import est valide
- pour comprendre pourquoi un import produit des warnings
- pour capturer directement l’état RBAC d’un cluster Kubernetes sans exporter de YAML au préalable

### Import direct cluster

Le bloc **Direct cluster import** utilise le kubeconfig disponible sur la machine qui exécute le backend.

Tu peux :

- laisser le kubeconfig par défaut
- donner un chemin explicite (par exemple `~/.kube/config`)
- choisir un contexte Kubernetes précis

Le backend lit alors en mode read-only :

- les namespaces
- les service accounts
- les roles
- les clusterroles
- les rolebindings
- les clusterrolebindings

Puis il envoie ces objets dans le même pipeline que les imports YAML/JSON.

### Test local recommandé avec kind + Podman

Pour un test local simple, tu peux utiliser les scripts du dépôt :

- `npm run cluster:kind:create`
- `npm run cluster:kind:use`
- `npm run cluster:kind:seed`

Le seed local crée volontairement un petit dataset RBAC contenant :

- des objets sains
- un binding cassé
- un rôle vide
- un accès `cluster-admin`
- des permissions wildcard
- un rôle de gestion RBAC plus dangereux

Cela permet de vérifier rapidement que l’application détecte bien les findings attendus après un **Import current cluster**.

### Exemple de warning utile

- `BROKEN_ROLE_REF` : un binding référence un rôle inexistant

---

## 5. Graph

### À quoi il sert

Le graphe est la vue principale d’explication.

Il affiche la chaîne :

`Subject -> Binding -> Role/ClusterRole -> Permission summary`

### Ce qu’on y trouve

- sélection d’un sujet
- graphe React Flow
- légende des types de nœuds
- panneau de détail du nœud sélectionné
- métadonnées de la projection de graphe

### Comment le lire

- **Subject** : l’identité concernée (`User`, `Group`, `ServiceAccount`)
- **Binding** : le lien RBAC qui attache le sujet à un rôle
- **Role / ClusterRole** : la définition des permissions
- **Permission summary** : résumé des règles utiles à l’affichage

### Ce que ça aide à répondre

- pourquoi ce sujet a accès ?
- via quel binding ?
- le scope est-il namespace ou cluster ?

---

## 6. Subjects

### À quoi il sert

Cette vue est orientée **sujet**.

### Ce qu’on peut faire

- filtrer par type (`USER`, `GROUP`, `SERVICE_ACCOUNT`)
- filtrer par namespace
- rechercher un sujet par nom
- sélectionner un sujet précis

### Ce que montre l’écran

- les permissions effectives du sujet
- les chemins RBAC qui donnent accès
- une explication ciblée pour `get pods`

### Quand l’utiliser

Utilise cette page quand tu veux répondre à :

- “Que peut faire ce sujet ?”
- “Pourquoi ce sujet peut lire des pods ?”

---

## 7. Resources

### À quoi il sert

Cette vue est orientée **ressource**.

### Ce qu’on peut faire

- chercher une ressource (`pods`, `secrets`, etc.)
- choisir un verbe (`get`, `list`, `create`, etc.)
- filtrer par namespace

### Ce que montre l’écran

- les sujets qui matchent la requête
- les bindings impliqués
- les rôles associés

### Quand l’utiliser

Utilise cette page quand tu veux répondre à :

- “Qui peut accéder à cette ressource ?”
- “Qui peut faire `get pods` ?”
- “Qui peut agir sur cette ressource dans tel namespace ?”

---

## 8. Anomalies

### À quoi il sert

Cette vue sert à repérer les problèmes ou risques RBAC détectés automatiquement.

### Ce qu’on y trouve

- compteurs par sévérité
- regroupement par type
- filtres par sévérité
- filtres par type
- recherche texte
- détail JSON de chaque finding

### Types de findings déjà supportés

- `CLUSTER_ADMIN_USAGE`
- `WILDCARD_PERMISSION`
- `BROKEN_ROLE_REF`
- `EMPTY_ROLE`
- `UNUSED_ROLE`
- `SENSITIVE_RESOURCE_FULL_ACCESS`
- `EXCESSIVE_PRIVILEGE`

### Navigation croisée

Quand un finding est lié à un sujet, la carte peut proposer :

- **Open subject access**
- **Open subject graph**

Cela permet de partir d’un problème pour revenir à l’explication RBAC détaillée.

---

## 9. Workflow recommandé

Pour découvrir un dataset RBAC, le parcours conseillé est :

1. **Imports** : créer ou charger un snapshot
2. **Dashboard** : vérifier les volumes et le statut
3. **Anomalies** : repérer les risques immédiats
4. **Graph** : comprendre un sujet précis visuellement
5. **Subjects** : examiner les permissions effectives d’un sujet
6. **Resources** : répondre à la question “qui peut accéder à X ?”

---

## 10. Ce que le MVP fait déjà bien

- importer des manifests RBAC Kubernetes YAML/JSON
- normaliser les objets RBAC dans PostgreSQL
- détecter plusieurs anomalies utiles
- expliquer visuellement un accès par sujet
- rechercher l’accès par ressource

## 11. Ce que le MVP ne fait pas encore

Le MVP ne couvre pas encore :

- sync live avec un cluster Kubernetes
- write-back vers le cluster
- auth enterprise
- multi-cluster
- simulation avancée de changements RBAC
- observabilité et hardening complets de production

---

## 12. Conseils de test manuel

### Test rapide recommandé

1. Aller sur `/imports`
2. Cliquer sur **Load anomaly sample**
3. Cliquer sur **Create import snapshot**
4. Vérifier ensuite :
   - `/anomalies`
   - `/graph`
   - `/subjects`
   - `/resources`

### Ce que tu dois voir

Dans le sample d’anomalies, tu devrais voir au moins :

- usage de `cluster-admin`
- wildcard permissions
- binding cassé (`BROKEN_ROLE_REF`)
- rôle vide (`EMPTY_ROLE`)
- rôle inutilisé (`UNUSED_ROLE`)

---

## 13. Résumé simple

- **Imports** = charger les manifests
- **Dashboard** = voir l’état global du snapshot
- **Anomalies** = voir les risques et incohérences
- **Graph** = comprendre visuellement la chaîne RBAC
- **Subjects** = voir ce qu’un sujet peut faire
- **Resources** = voir qui peut accéder à une ressource
