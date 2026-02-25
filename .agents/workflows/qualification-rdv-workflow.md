---
description: Workflow complet de qualification RDV — Suivi Commercial CRM
---

# 🗺️ Workflow de Qualification RDV — Suivi Commercial

## Point d'entrée : Lead en statut `RDV_PLANIFIE`

> **Question initiale :** "Le lead a-t-il honoré le rendez-vous ?"
> **Options :** `Oui` / `Non`

---

## ═══════════════════════════════════════════════
## BRANCHE A — RDV NON HONORÉ (Réponse = Non)
## ═══════════════════════════════════════════════

> Le lead ne s'est pas présenté au RDV.
> **Afficher 2 boutons interactifs :**

### A1 — PLANIFIER RELANCE

- Ouvrir `FixAppointmentModal` (modal pour planifier une relance téléphonique)
- **Statut lead →** `RDV_NON_HONORE`
- **Bouton d'action affiché →** `APPELER` (qui lance la branche A2)

### A2 — APPELER LE LEAD

- Ouvrir `CallModal`
- **6 résultats possibles :**

| # | Résultat de l'appel | Action | Nouveau statut |
|---|---------------------|--------|----------------|
| A2a | ✅ Répondu — Intéressé | Fixer RDV + Envoyer SMS confirmation | `RDV_PLANIFIE` |
| A2b | ❌ Répondu — Non intéressé | Marquer comme Perdu | `PERDU` |
| A2c | 🔄 Répondu — Rappeler plus tard | Planifier relance | `A_RELANCER` |
| A2d | 📞 Pas de réponse — Message laissé | Planifier relance | `A_RELANCER` |
| A2e | 📵 Pas de réponse — Hors ligne | Planifier relance → Perdu (après N relances) | `A_RELANCER` → `PERDU` |
| A2f | ⚠️ Numéro incorrect | Marquer comme Perdu + Envoyer email | `PERDU` |

---

## ═══════════════════════════════════════════════
## BRANCHE B — RDV HONORÉ (Réponse = Oui)
## ═══════════════════════════════════════════════

> Le lead s'est présenté. Poser la question suivante :
> **Question :** "Quel est votre mode de financement ?"
> **Options :** `CPF` / `Financement Personnel` / `Pôle Emploi` / `OPCO`

---

### B1 — FINANCEMENT PERSONNEL
#### (Parcours le plus court)

```
Honoré → Financement Personnel → Test de Positionnement
```

- **Afficher :** `FAIRE TEST DE POSITIONNEMENT`
- **→ Sous-workflow :** [SW-TEST] Test de Positionnement (voir ci-dessous)

---

### B2 — FINANCEMENT CPF
#### (Parcours le plus complexe)

> **Question :** "Avez-vous déjà un compte CPF actif et accessible ?"
> **Options :** `Oui` / `Non`

---

#### B2a — OUI, compte CPF actif

```
Honoré → CPF → Compte actif → Action réalisée
```

- **Afficher :** "Action réalisée"
- **Options :**
  - `FAIRE TEST DE POSITIONNEMENT` → [SW-TEST]
  - `VÉRIFICATION COMPTE CPF` → [SW-VERIF-CPF]

---

#### B2b — NON, pas de compte CPF actif

> **Question :** "Quelle est la durée de votre pièce d'identité ?"
> **Options :** `CNI/TS + de 5 ans` / `CNI/TS - de 5 ans`

---

##### B2b-i — CNI/TS **+ de 5 ans** (ancienne CNI)

```
Honoré → CPF → Pas de compte → CNI +5 ans → Identité Numérique OU Vérification CPF
```

- **Options :**
  - `IDENTITÉ NUMÉRIQUE` → [SW-ID-NUMERIQUE]
  - `VÉRIFICATION COMPTE CPF` → [SW-VERIF-CPF]

---

##### B2b-ii — CNI/TS **- de 5 ans** (CNI récente)

```
Honoré → CPF → Pas de compte → CNI -5 ans → Ouverture CPF OU Identité Num. OU Vérif. CPF
```

- **Afficher :** "Action réalisée"
- **Options :**
  - `OUVERTURE DE COMPTE CPF` → [SW-OUVERTURE-CPF]
  - `IDENTITÉ NUMÉRIQUE` → [SW-ID-NUMERIQUE]
  - `VÉRIFICATION COMPTE CPF` → [SW-VERIF-CPF]

---

### B3 — PÔLE EMPLOI
#### (À détailler ultérieurement)

---

### B4 — OPCO
#### (À détailler ultérieurement)

---

## ═══════════════════════════════════════════════
## SOUS-WORKFLOWS RÉUTILISABLES
## ═══════════════════════════════════════════════

> Ces blocs reviennent à plusieurs endroits dans l'arbre de décision.
> Ils doivent être implémentés comme des **composants réutilisables**.

---

### [SW-TEST] — Test de Positionnement

> **Utilisé par :** B1, B2a, B2b-i (après ID num.), B2b-ii (après ID num.), après vérif. CPF réussie
>
> **Options :**
> - `Démarrer le test` → Appel au module TEST pour effectuer le test
> - `Envoyer un lien` → Le système génère un lien de test à envoyer au lead

---

### [SW-VERIF-CPF] — Vérification Compte CPF

> **Utilisé par :** B2a, B2b-i, B2b-ii
>
> **Message informatif :**
> *"La vérification de compte peut durer jusqu'à 48h. Elle est effectuée par le demandeur
> à partir de son compte CPF. Merci de demander au lead de se connecter à son compte CPF
> et d'effectuer l'opération de vérification."*
>
> **Statut lead →** `VERIFICATION_COMPTE_CPF`
> **Bouton d'action →** `VÉRIFIER COMPTE`

Quand le bouton `VÉRIFIER COMPTE` est cliqué :

> **Question :** "La vérification de votre compte CPF a été validée ?"
> **Options :** `Oui` / `Non`

| Réponse | Sous-options | Action | Statut |
|---------|-------------|--------|--------|
| **Oui** | — | → [SW-TEST] Test de positionnement | (dépend du test) |
| **Non** | `Vérification toujours en cours` | Rester dans l'état actuel | `VERIFICATION_COMPTE_CPF`, Bouton = `VÉRIFIER COMPTE` |
| **Non** | `Le compte a un problème` → `Ouverture un compte CPF` | → [SW-OUVERTURE-CPF] | (dépend de l'ouverture) |
| **Non** | `Le compte a un problème` → `Autres problèmes` | Ouvrir champ description du problème | `PROBLEMES_SAV`, Bouton = `QUALIFICATION` |

---

### [SW-ID-NUMERIQUE] — Identité Numérique

> **Utilisé par :** B2b-i, B2b-ii
>
> **Question :** "Votre identité numérique a été validée ?"
> **Options :** `Oui` / `Non`

| Réponse | Sous-options | Action | Statut |
|---------|-------------|--------|--------|
| **Oui** | — | → [SW-TEST] Test de positionnement | (dépend du test) |
| **Non** | `Création compte en cours` | Statut reste inchangé, même bouton d'action | (inchangé) |
| **Non** | `Le compte a un problème` → `Ouverture un compte CPF` | → [SW-OUVERTURE-CPF] | (dépend) |
| **Non** | `Le compte a un problème` → `Vérification de compte` | → [SW-VERIF-CPF] | (dépend) |
| **Non** | `Le compte a un problème` → `Autres problèmes` | Champ description | `PROBLEMES_SAV` |

---

### [SW-OUVERTURE-CPF] — Ouverture de Compte CPF

> **Utilisé par :** B2b-ii, depuis [SW-VERIF-CPF], depuis [SW-ID-NUMERIQUE]
>
> **Éléments affichés :**
> 1. Upload de fichier — titre : "Formulaire / CNI / Carte Vitale"
> 2. Upload de fichier — titre : "Autres documents"
> 3. Bouton `Envoyer courrier` → Ouvre un **modal calendrier** pour spécifier la date d'envoi
>
> **Statut lead →** `COURRIERS_ENVOYES`
> **Bouton d'action →** `COURRIERS REÇUS`

Quand le bouton `COURRIERS REÇUS` est cliqué :

> **Question :** "Avez-vous reçu le courrier ?"
> **Options :** `J'ai reçu mon courrier` / `Je n'ai pas reçu mon courrier`

| Réponse | Action | Statut |
|---------|--------|--------|
| **J'ai reçu mon courrier** | Modal date de réception → puis `FixAppointmentModal` (prochain RDV) | `COURRIERS_RECUS`, Bouton = `INSCRIPTION` |
| **Je n'ai pas reçu mon courrier** | `Autres problèmes` → champ description | `PROBLEMES_SAV`, Bouton = `QUALIFICATION` |

---

## ═══════════════════════════════════════════════
## 📊 RÉSUMÉ : CARTE DES STATUTS
## ═══════════════════════════════════════════════

```
RDV_PLANIFIE
 │
 ├── [Non honoré] ──→ RDV_NON_HONORE ──→ A_RELANCER ──→ (cycle appel/relance)
 │                                                    └──→ PERDU
 │
 └── [Honoré] ──→ Choix financement
                  │
                  ├── Personnel ──→ [SW-TEST] ──→ (suite inscriptions)
                  │
                  ├── CPF ──→ Compte actif ?
                  │           │
                  │           ├── Oui ──→ [SW-TEST] ou [SW-VERIF-CPF]
                  │           │
                  │           └── Non ──→ Durée CNI ?
                  │                       │
                  │                       ├── +5 ans ──→ [SW-ID-NUMERIQUE] ou [SW-VERIF-CPF]
                  │                       │
                  │                       └── -5 ans ──→ [SW-OUVERTURE-CPF] ou [SW-ID-NUMERIQUE] ou [SW-VERIF-CPF]
                  │
                  ├── Pôle Emploi ──→ (à détailler)
                  │
                  └── OPCO ──→ (à détailler)


         COURRIERS_ENVOYES ──→ COURRIERS_RECUS ──→ INSCRIPTION
                                              └──→ PROBLEMES_SAV

         VERIFICATION_COMPTE_CPF ──→ [SW-TEST] (si validé)
                                 └──→ [SW-OUVERTURE-CPF] (si problème)
                                 └──→ PROBLEMES_SAV (si autre problème)
```

---

## ═══════════════════════════════════════════════
## 📋 INVENTAIRE DES COMPOSANTS UI (Modals)
## ═══════════════════════════════════════════════

| # | Composant | Description | Utilisé dans |
|---|-----------|-------------|--------------|
| 1 | `QualificationWizard` | Wizard multi-étapes principal (arbre de décision) | Point d'entrée depuis le Kanban |
| 2 | `CallModal` | Résultat d'appel (6 issues possibles) | Branche A2 |
| 3 | `FixAppointmentModal` | Planifier un RDV / relance | A1, A2a, SW-OUVERTURE-CPF |
| 4 | `TestPositionnementModal` | Démarrer test ou envoyer lien | [SW-TEST] |
| 5 | `VerificationCpfModal` | Vérification compte CPF | [SW-VERIF-CPF] |
| 6 | `IdentiteNumeriqueModal` | Validation identité numérique | [SW-ID-NUMERIQUE] |
| 7 | `OuvertureCompteCpfModal` | Upload docs + envoi courrier | [SW-OUVERTURE-CPF] |
| 8 | `CourriersRecusModal` | Confirmation réception courrier | Après [SW-OUVERTURE-CPF] |
| 9 | `ProblemeDescriptionModal` | Champ libre pour décrire un problème | Plusieurs branches |

---

## ═══════════════════════════════════════════════
## 📋 INVENTAIRE DES STATUTS LEAD
## ═══════════════════════════════════════════════

| Statut | Description | Bouton d'action suivant |
|--------|-------------|------------------------|
| `RDV_PLANIFIE` | RDV fixé, en attente | `QUALIFIER RDV` |
| `RDV_NON_HONORE` | Lead ne s'est pas présenté | `APPELER` |
| `A_RELANCER` | Relance planifiée | `APPELER` |
| `VERIFICATION_COMPTE_CPF` | En attente de vérification CPF (48h) | `VÉRIFIER COMPTE` |
| `COURRIERS_ENVOYES` | Documents envoyés | `COURRIERS REÇUS` |
| `COURRIERS_RECUS` | Documents reçus | `INSCRIPTION` |
| `PROBLEMES_SAV` | Problème à résoudre | `QUALIFICATION` |
| `PERDU` | Lead abandonné (avec raison) | — |

---

## ═══════════════════════════════════════════════
## 🔑 OBSERVATIONS & POINTS D'ATTENTION
## ═══════════════════════════════════════════════

1. **Sous-workflow [SW-VERIF-CPF]** est identique dans 3 endroits (B2a, B2b-i, B2b-ii)
   → Doit être un **composant unique réutilisable**

2. **Sous-workflow [SW-ID-NUMERIQUE]** est identique dans 2 endroits (B2b-i, B2b-ii)
   → Doit être un **composant unique réutilisable**

3. **Sous-workflow [SW-TEST]** revient dans 5+ contextes différents
   → Composant réutilisable prioritaire

4. **Sous-workflow [SW-OUVERTURE-CPF]** revient dans 3+ contextes
   → Composant réutilisable avec upload de fichiers

5. **Pôle Emploi et OPCO** sont mentionnés comme options mais non détaillés
   → À compléter dans une prochaine itération

6. **Le statut `VERIFICATION_COMPTE_CPF`** n'existe pas encore dans le schema Prisma
   → Nouveau statut à créer

7. **Le statut `A_RELANCER`** n'existe pas encore (distinct de `RDV_NON_HONORE`)
   → Nouveau statut à créer

8. **Chaque statut a un BOUTON D'ACTION spécifique** qui détermine la prochaine étape
   → Le CRM Kanban doit afficher ce bouton dans la carte lead
