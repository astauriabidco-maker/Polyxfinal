# CAHIER DES CHARGES FONCTIONNEL (CdCF) - ERP FORMATION

## OBJECTIF
Plateforme de gestion de formation "Compliance by Design" (Qualiopi, CPF, OPCO).
Règle d'or : Aucune étape administrative ne peut être franchie si les preuves de l'étape précédente sont manquantes.

## PHASE 1 : PROSPECTION & OFFRE
- **Règles :**
  - Impossible de publier une offre si champs obligatoires vides (Prérequis, Objectifs, Tarifs).
  - Blocage si certification inactive (Check API France Compétences).
  - Versionning obligatoire des programmes (Snapshot à la date de signature).
- **Preuves générées :** Programme daté, CGV.

## PHASE 2 : ADMISSION
- **Règles :**
  - Test de positionnement envoyé automatiquement.
  - Scoring automatique : Si score < seuil -> Alerte pédagogique.
  - Déclaration PSH (Handicap) obligatoire.
- **Preuves générées :** Test positionnement rempli, Analyse du besoin.

## PHASE 3 : CONTRACTUALISATION (BLOQUANT)
- **Règles :**
  - Convention (B2B) ou Contrat (B2C) avec mentions légales L.6353-1.
  - Délai rétractation CPF (11 jours ouvrés) calculé et bloquant pour le démarrage.
  - Validation financière (Accord OPCO ou Solde CPF) requise avant démarrage.
- **Preuves générées :** Contrat signé (eIDAS), Accord prise en charge.

## PHASE 4 : DÉROULEMENT
- **Règles :**
  - Suivi assiduité par 1/2 journée (Présentiel) ou Logs + Jalons (FOAD).
  - Alerte décrochage automatique.
  - Gestion des Abandons via Machine à État (Force Majeure vs Volontaire).
- **Preuves générées :** Émargements, Relevés de connexion, Travaux.

## PHASE 5 : CLÔTURE & FACTURATION
- **Règles :**
  - "Compliance Gate" finale : Impossible de générer le Certificat de Réalisation si assiduité < 100% sans justif validé.
  - Facturation bloquée tant que le Certificat n'est pas généré.
- **Preuves générées :** Certificat de Réalisation, Évaluations à chaud, Facture.
