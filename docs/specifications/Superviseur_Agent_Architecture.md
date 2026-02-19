# Architecture & Spécifications : Agent Superviseur Conformité

## 1. Objectif Global
L'objectif est d'implémenter un **Agent Superviseur** intelligent au sein de la plateforme Polyx, capable d'automatiser la surveillance de la conformité réglementaire (Qualiopi, RGPD, BPF, DRIEETS, OPCO). Cet agent agira comme un "auditeur permanent" pour garantir que l'organisme de formation reste conforme en temps réel.

## 2. Rôles et Responsabilités

### A. Surveillance Continue (Le "Watchdog") 🕵️‍♂️
Le module de surveillance s'exécutera en tâche de fond (Cron Jobs) pour scanner périodiquement les données et détecter les anomalies.

1.  **Surveillance RGPD :**
    *   **Rétention :** Alerter sur les données personnelles dépassant la durée de conservation légale (3 ans pour les prospects inactifs).
    *   **Sous-traitance :** Signaler les sous-traitants actifs n'ayant pas de DPA (Data Processing Agreement) signé.
    *   **Sécurité :** Détecter l'absence de DPO désigné ou d'AIPD requise.

2.  **Surveillance Qualiopi :**
    *   **Preuves :** Vérifier la présence et la validité des documents de preuve pour les indicateurs (Ind. 17, 26, etc.).
    *   **Délais :** Alerter sur les documents arrivant à échéance (ex: attestations d'assurance, certifications formateurs).
    *   **Feedback :** Analyser les retours stagiaires pour détecter les insatisfactions (Ind. 30).

3.  **Surveillance BPF / DRIEETS :**
    *   **Cohérence :** Vérifier la cohérence entre le CA facturé et les heures dispensées avant l'export du Bilan Pédagogique et Financier.
    *   **Complétude :** Signaler les champs manquants dans les fiches stagiaires (NIR, date de naissance) bloquant l'export.

### B. Actions Automatisées ⚡
L'agent pourra exécuter des actions pré-approuvées pour soulager les administrateurs.

1.  **Notifications :** Envoi d'emails ou notifications in-app aux responsables concernés (ex: "Action requise : 3 DPA manquants").
2.  **Rapports :** Génération automatique d'un rapport de conformité hebdomadaire/mensuel (PDF/Email).
3.  **Archivage :** Proposition de purge automatique des données obsolètes (avec validation manuelle ou automatique).

### C. Assistant Interactif (Optionnel / LLM) 💬
Une interface conversationnelle (Chatbot) pour interagir avec les données de conformité.

*   *"Quel est mon taux de conformité Qualiopi ce mois-ci ?"*
*   *"Liste-moi les formateurs dont le dossier est incomplet."*
*   *"Génère-moi une trame de réponse pour une plainte stagiaire."*

## 3. Architecture Technique

### Backend (NestJS / Next.js API Routes)
*   **Service :** `SupervisorService` (Orchestrateur central).
*   **Schedulers :** Utilisation de `node-cron` ou Vercel Cron pour les tâches planifiées.
*   **Data Access :** `ComplianceService`, `RGPDService`, `QualiopiService` (existants ou à étendre).
*   **Engine :** Moteur de règles pour évaluer la conformité (ex: `if (dpaMissing > 0) urgency = HIGH`).

### Frontend (React / Dashboard)
*   **Widget Superviseur :** Un composant "Assistant" flottant ou intégré au Dashboard Conformité.
*   **Centre de Notifications :** Une vue dédiée aux alertes de l'agent.
*   **Configuration :** Page de réglages pour activer/désactiver les modules de surveillance et définir les seuils d'alerte.

## 4. Roadmap d'Implémentation

### Phase 1 : Consolidation des Métriques (Déjà entamé)
*   Centralisation des indicateurs BPF, RGPD, Qualiopi dans le Dashboard Conformité.
*   Calcul des scores de conformité.

### Phase 2 : Moteur de Règles & Alertes (Le "Watchdog")
*   Implémentation des tâches Cron de surveillance.
*   Création du système de notifications in-app.
*   Développement des règles spécifiques (Rétention, DPA, Champs obligatoires).

### Phase 3 : Actions & Interactivité
*   Actions correctives en un clic (ex: "Envoyer relance DPA").
*   (Optionnel) Intégration d'un LLM pour l'analyse sémantique et l'assistant conversationnel.

## 5. Conclusion
L'agent superviseur transformera la plateforme d'un simple outil de gestion passive en un partenaire actif de la conformité, réduisant les risques d'audit et la charge mentale des administrateurs.
