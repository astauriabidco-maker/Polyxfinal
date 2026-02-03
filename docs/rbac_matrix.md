# MATRICE DES RESPONSABILITÉS ET DROITS (RBAC) - ERP FORMATION

## 1. Légende des Niveaux d'Accès

Pour garantir la lecture, nous utilisons la notation RACI adaptée au système :

| Symbole | Niveau | Description |
|:-------:|--------|-------------|
| 👁️ | **Lecture** | Peut consulter les données |
| ✏️ | **Édition** | Peut saisir, modifier ou uploader une donnée |
| ✅ | **Validation** | "Compliance Gate". Son action débloque l'étape suivante (ex: passage de "Brouillon" à "Actif") |
| 🛡️ | **Forçage** | Droit exceptionnel permettant de contourner une règle bloquante (Doit générer une alerte Audit) |
| ⛔ | **Interdit** | Accès strictement refusé |

---

## 2. Définition des Rôles Système

| Rôle | Description |
|------|-------------|
| **ADMIN** | Super Admin : DSI ou Gérant. Accès technique total (mais tracé) |
| **RESP_PEDAGO** | Responsable Pédagogique : Garant du contenu, des méthodes et de la certification (Qualiopi) |
| **RESP_ADMIN** | Responsable Admin/Financier : Garant de la facturation, des contrats et des relations financeurs |
| **REF_QUALITE** | Référent Qualité : Garant du respect des processus et des réclamations |
| **FORMAT** | Formateur : Intervenant terrain (Accès restreint à ses sessions) |

---

## 3. Matrice Détaillée par Phase Critique

### PHASE 1 : OFFRE & CATALOGUE

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Créer / Modifier un programme | ✏️ | 👁️ | 👁️ | 👁️ | ✏️ |
| Valider la publication (API EDOF/Web) | ✅ | ⛔ | 👁️ | ⛔ | 🛡️ |
| Désactiver une certification (Fin de validité) | ✅ | ⛔ | ✅ | ⛔ | 🛡️ |

---

### PHASE 2 : ADMISSION

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Valider un dossier apprenant (Prérequis OK) | ✅ | 👁️ | 👁️ | ⛔ | 🛡️ |
| Forcer une admission (Si prérequis KO) | 🛡️ *(Justif. obligatoire)* | ⛔ | 👁️ *(Notifié)* | ⛔ | 🛡️ |
| Valider adaptations PSH (Handicap) | ✅ | 👁️ | 👁️ | 👁️ | 👁️ |

---

### PHASE 3 : CONTRACTUALISATION

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Générer Contrat / Convention | 👁️ | ✏️ | 👁️ | ⛔ | ✏️ |
| Valider le Financement (Accord OPCO reçu) | 👁️ | ✅ | ⛔ | ⛔ | 🛡️ |
| Modifier prix / date après signature | ⛔ | 🛡️ *(Avenant auto)* | 👁️ | ⛔ | 🛡️ |

---

### PHASE 4 : DÉROULEMENT

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Saisir l'assiduité / Émargement | 👁️ | ✏️ | 👁️ | ✏️ | ✏️ |
| Signaler un décrochage (Alerte) | 👁️ | 👁️ | 👁️ | ✏️ | 👁️ |
| Valider un ABANDON (Arrêt définitif) | ✅ *(Motif Pédago)* | ✅ *(Impact Factu)* | 👁️ | ⛔ | 🛡️ |
| Forcer une date (Rétroactivité émargement) | ⛔ | 🛡️ *(Log Audit)* | 👁️ *(Alerte)* | ⛔ | 🛡️ |

---

### PHASE 5 : CLÔTURE & PREUVES

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Saisir résultats / évaluations | ✏️ | ⛔ | 👁️ | ✏️ | ✏️ |
| Valider Certificat de Réalisation | ✅ | ⛔ | 👁️ | ⛔ | 🛡️ |
| Débloquer Facturation (Service Fait) | 👁️ | ✅ | ⛔ | ⛔ | 🛡️ |

---

### TRANSVERSE : QUALITÉ

| Action | RESP_PEDAGO | RESP_ADMIN | REF_QUALITE | FORMAT | ADMIN |
|--------|:-----------:|:----------:|:-----------:|:------:|:-----:|
| Clôturer une Réclamation | 👁️ | 👁️ | ✅ | 👁️ | 🛡️ |
| Purge RGPD (Anonymisation) | ⛔ | ⛔ | ✅ | ⛔ | 🛡️ |

---

## 4. Règles de Ségrégation des Devoirs (SoD)

> **Principe fondamental** : Aucun rôle unique ne peut à la fois exécuter ET valider une action critique.

| Contrainte SoD | Explication |
|----------------|-------------|
| Publication Offre | `RESP_PEDAGO` valide → Vérification auto certif (SYSTEM) |
| Admission Forcée | `RESP_PEDAGO` force → `REF_QUALITE` notifié (Log obligatoire) |
| Validation Financement | `RESP_ADMIN` valide → `SYSTEM` vérifie solde/accord |
| Validation Abandon | Double validation : `RESP_PEDAGO` + `RESP_ADMIN` |
| Forçage Date | `ADMIN` seul → `REF_QUALITE` alerté (Audit Log Immuable) |
| Génération Certificat | `SYSTEM` génère si assiduité 100% → `RESP_PEDAGO` si anomalie |
| Déblocage Facture | `SYSTEM` vérifie Certificat → `RESP_ADMIN` débloque |
