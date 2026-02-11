/**
 * DOCUMENTATION API PARTENAIRE — Générateur PDF personnalisé
 * ===========================================================
 * Génère un PDF de documentation technique personnalisé pour chaque partenaire.
 * Inclut :
 *   - Endpoint URL et authentification
 *   - Schéma JSON du lead
 *   - Exemples de code (cURL, JavaScript, Python)
 *   - Codes d'erreur et bonnes pratiques
 *   - Rate limits et coordonnées support
 */

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Link,
} from '@react-pdf/renderer';
import React from 'react';

// ─── Types ────────────────────────────────────────────────────

export interface ApiDocData {
    partner: {
        companyName: string;
        contactName: string;
        contactEmail: string;
        apiKeyPrefix: string; // pk_live_xxxx...
        rateLimit: number;
    };
    org: {
        name: string;
        supportEmail: string;
    };
    meta: {
        generatedAt: string;
        baseUrl: string;
    };
}

// ─── Styles ───────────────────────────────────────────────────

const colors = {
    primary: '#6d28d9',
    primaryLight: '#8b5cf6',
    primaryBg: '#f5f3ff',
    dark: '#0f172a',
    text: '#1e293b',
    textLight: '#64748b',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    success: '#059669',
    successBg: '#ecfdf5',
    error: '#dc2626',
    errorBg: '#fef2f2',
    warning: '#d97706',
    warningBg: '#fffbeb',
    info: '#2563eb',
    infoBg: '#eff6ff',
    codeBg: '#1e293b',
    codeText: '#e2e8f0',
};

const styles = StyleSheet.create({
    // ─── Page ───
    page: {
        padding: 50,
        paddingBottom: 70,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: colors.text,
        lineHeight: 1.5,
    },

    // ─── Cover Page ───
    coverPage: {
        padding: 50,
        fontFamily: 'Helvetica',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
        textAlign: 'center',
    },
    coverSubtitle: {
        fontSize: 14,
        color: colors.primaryLight,
        marginBottom: 40,
        textAlign: 'center',
    },
    coverInfoBlock: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderRadius: 8,
        padding: 20,
        width: '80%',
        marginBottom: 30,
    },
    coverInfoLabel: {
        fontSize: 8,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    coverInfoValue: {
        fontSize: 12,
        color: '#ffffff',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    coverVersion: {
        fontSize: 9,
        color: colors.textMuted,
        marginTop: 40,
        textAlign: 'center',
    },

    // ─── Section Headers ───
    h1: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 12,
        marginTop: 20,
        borderBottomWidth: 2,
        borderBottomColor: colors.primary,
        paddingBottom: 6,
    },
    h2: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.dark,
        marginBottom: 8,
        marginTop: 14,
    },
    h3: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 6,
        marginTop: 10,
    },

    // ─── Text ───
    p: {
        fontSize: 9,
        marginBottom: 6,
        lineHeight: 1.6,
    },
    pSmall: {
        fontSize: 8,
        color: colors.textLight,
        marginBottom: 4,
    },
    bold: {
        fontWeight: 'bold',
    },

    // ─── Code blocks ───
    codeBlock: {
        backgroundColor: colors.codeBg,
        borderRadius: 4,
        padding: 12,
        marginBottom: 10,
        marginTop: 4,
    },
    codeLine: {
        fontSize: 7.5,
        fontFamily: 'Courier',
        color: colors.codeText,
        lineHeight: 1.5,
    },
    codeComment: {
        fontSize: 7.5,
        fontFamily: 'Courier',
        color: '#6b7280',
        lineHeight: 1.5,
    },
    codeHighlight: {
        fontSize: 7.5,
        fontFamily: 'Courier',
        color: '#a78bfa',
        lineHeight: 1.5,
    },

    // ─── Inline code ───
    inlineCode: {
        fontSize: 8,
        fontFamily: 'Courier',
        backgroundColor: '#f1f5f9',
        padding: 2,
        color: colors.primary,
    },

    // ─── Info boxes ───
    infoBox: {
        backgroundColor: colors.infoBg,
        borderLeftWidth: 3,
        borderLeftColor: colors.info,
        padding: 10,
        marginBottom: 10,
        borderRadius: 2,
    },
    warningBox: {
        backgroundColor: colors.warningBg,
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
        padding: 10,
        marginBottom: 10,
        borderRadius: 2,
    },
    successBox: {
        backgroundColor: colors.successBg,
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
        padding: 10,
        marginBottom: 10,
        borderRadius: 2,
    },
    errorBox: {
        backgroundColor: colors.errorBg,
        borderLeftWidth: 3,
        borderLeftColor: colors.error,
        padding: 10,
        marginBottom: 10,
        borderRadius: 2,
    },
    boxTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    boxText: {
        fontSize: 8,
        lineHeight: 1.5,
    },

    // ─── Tables ───
    table: {
        marginBottom: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.primaryBg,
        borderBottomWidth: 1,
        borderBottomColor: colors.primary,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: '#fafafa',
    },
    cellHeader: {
        fontSize: 8,
        fontWeight: 'bold',
        padding: 6,
        color: colors.primary,
    },
    cell: {
        fontSize: 8,
        padding: 6,
        color: colors.text,
    },
    cellCode: {
        fontSize: 7.5,
        padding: 6,
        fontFamily: 'Courier',
        color: colors.primary,
    },

    // ─── Badge / Tag ───
    badge: {
        fontSize: 7,
        backgroundColor: colors.primary,
        color: '#ffffff',
        padding: 3,
        paddingHorizontal: 6,
        borderRadius: 3,
        fontWeight: 'bold',
    },
    badgeSuccess: {
        fontSize: 7,
        backgroundColor: colors.success,
        color: '#ffffff',
        padding: 3,
        paddingHorizontal: 6,
        borderRadius: 3,
        fontWeight: 'bold',
    },

    // ─── Footer ───
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 50,
        right: 50,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 7,
        color: colors.textMuted,
    },

    // ─── Divider ───
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginVertical: 12,
    },

    // ─── TOC ───
    tocItem: {
        fontSize: 10,
        marginBottom: 6,
        color: colors.text,
    },
    tocNumber: {
        color: colors.primary,
        fontWeight: 'bold',
    },

    // ─── Misc ───
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    confidentialTag: {
        position: 'absolute',
        top: 15,
        right: 50,
        fontSize: 7,
        color: '#e11d48',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
});

// ─── React-PDF Component ──────────────────────────────────────

export function ApiDocumentationPdf({ data }: { data: ApiDocData }) {
    const { partner, org, meta } = data;

    return (
        <Document>
            {/* ═══════════════════════════════════════════════════════
                PAGE 1 — COVER
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.coverPage}>
                <Text style={{ fontSize: 12, color: colors.primaryLight, marginBottom: 60 }}>
                    {org.name}
                </Text>

                <Text style={styles.coverTitle}>Documentation API</Text>
                <Text style={styles.coverSubtitle}>Ingestion de Leads Partenaire</Text>

                <View style={styles.coverInfoBlock}>
                    <Text style={styles.coverInfoLabel}>Partenaire</Text>
                    <Text style={styles.coverInfoValue}>{partner.companyName}</Text>

                    <Text style={styles.coverInfoLabel}>Contact technique</Text>
                    <Text style={styles.coverInfoValue}>{partner.contactName} ({partner.contactEmail})</Text>

                    <Text style={styles.coverInfoLabel}>Clé API</Text>
                    <Text style={styles.coverInfoValue}>{partner.apiKeyPrefix}...</Text>

                    <Text style={styles.coverInfoLabel}>Rate Limit</Text>
                    <Text style={{ ...styles.coverInfoValue, marginBottom: 0 }}>{partner.rateLimit} requêtes / heure</Text>
                </View>

                <View style={styles.coverInfoBlock}>
                    <Text style={styles.coverInfoLabel}>Base URL</Text>
                    <Text style={styles.coverInfoValue}>{meta.baseUrl}</Text>

                    <Text style={styles.coverInfoLabel}>Version</Text>
                    <Text style={{ ...styles.coverInfoValue, marginBottom: 0 }}>v1.0</Text>
                </View>

                <Text style={styles.coverVersion}>
                    Document généré le {meta.generatedAt} — CONFIDENTIEL
                </Text>
            </Page>

            {/* ═══════════════════════════════════════════════════════
                PAGE 2 — TABLE DES MATIÈRES + DÉMARRAGE RAPIDE
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                <Text style={styles.h1}>Table des matières</Text>
                {[
                    '1. Démarrage rapide',
                    '2. Authentification',
                    '3. Endpoint — Soumission de lead',
                    '4. Schéma JSON détaillé',
                    '5. Codes de réponse',
                    '6. Exemples de code',
                    '7. Rate Limiting',
                    '8. Conformité RGPD',
                    '9. Bonnes pratiques',
                    '10. Support technique',
                ].map((item, i) => (
                    <Text key={i} style={styles.tocItem}>
                        <Text style={styles.tocNumber}>{item.split('.')[0]}.</Text>
                        {item.substring(item.indexOf('.'))}
                    </Text>
                ))}

                <View style={styles.divider} />

                {/* ─── 1. Démarrage rapide ─── */}
                <Text style={styles.h1}>1. Démarrage rapide</Text>
                <Text style={styles.p}>
                    L&apos;API permet de soumettre des leads qualifiés directement dans le pipeline de {org.name}. Voici les 3 étapes pour commencer :
                </Text>

                <View style={styles.successBox}>
                    <Text style={styles.boxTitle}>✅ Étape 1 — Votre clé API</Text>
                    <Text style={styles.boxText}>
                        Votre clé API personnelle : {partner.apiKeyPrefix}...{'\n'}
                        Transmettez-la via le header X-API-KEY dans chaque requête.
                    </Text>
                </View>

                <View style={styles.successBox}>
                    <Text style={styles.boxTitle}>✅ Étape 2 — Envoyez votre premier lead</Text>
                    <Text style={styles.boxText}>
                        Faites un POST vers {meta.baseUrl}/api/v1/partners/leads avec un JSON contenant les données du prospect.
                    </Text>
                </View>

                <View style={styles.successBox}>
                    <Text style={styles.boxTitle}>✅ Étape 3 — Vérifiez la réponse</Text>
                    <Text style={styles.boxText}>
                        Un code 201 confirme la réception. Vous recevrez un leadId unique pour le suivi.
                    </Text>
                </View>

                <Text style={styles.h3}>Exemple rapide (cURL)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeLine}>curl -X POST {meta.baseUrl}/api/v1/partners/leads \</Text>
                    <Text style={styles.codeLine}>  -H &quot;Content-Type: application/json&quot; \</Text>
                    <Text style={styles.codeLine}>  -H &quot;X-API-KEY: {partner.apiKeyPrefix}...&quot; \</Text>
                    <Text style={styles.codeLine}>  -d &apos;{'{'}</Text>
                    <Text style={styles.codeLine}>    &quot;nom&quot;: &quot;Dupont&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;prenom&quot;: &quot;Jean&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;email&quot;: &quot;jean.dupont@example.com&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;telephone&quot;: &quot;0612345678&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;adresse&quot;: &quot;12 rue de la Paix&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;codePostal&quot;: &quot;75001&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;ville&quot;: &quot;Paris&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;formationSouhaitee&quot;: &quot;Développeur Web&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;sourceUrl&quot;: &quot;https://votre-site.fr/formation&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;consentDate&quot;: &quot;2026-02-11T10:00:00Z&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;consentText&quot;: &quot;J accepte d etre contacté...&quot;</Text>
                    <Text style={styles.codeLine}>  {'}'}&apos;</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Documentation API — {org.name} × {partner.companyName}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>
            </Page>

            {/* ═══════════════════════════════════════════════════════
                PAGE 3 — AUTHENTIFICATION + ENDPOINT
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                {/* ─── 2. Authentification ─── */}
                <Text style={styles.h1}>2. Authentification</Text>
                <Text style={styles.p}>
                    Toutes les requêtes doivent inclure votre clé API dans le header HTTP X-API-KEY.
                </Text>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.cellHeader, width: '25%' }}>Header</Text>
                        <Text style={{ ...styles.cellHeader, width: '35%' }}>Valeur</Text>
                        <Text style={{ ...styles.cellHeader, width: '40%' }}>Description</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cellCode, width: '25%' }}>X-API-KEY</Text>
                        <Text style={{ ...styles.cellCode, width: '35%' }}>{partner.apiKeyPrefix}...</Text>
                        <Text style={{ ...styles.cell, width: '40%' }}>Votre clé API unique</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cellCode, width: '25%' }}>Content-Type</Text>
                        <Text style={{ ...styles.cellCode, width: '35%' }}>application/json</Text>
                        <Text style={{ ...styles.cell, width: '40%' }}>Format obligatoire</Text>
                    </View>
                </View>

                <View style={styles.warningBox}>
                    <Text style={styles.boxTitle}>⚠️ Sécurité</Text>
                    <Text style={styles.boxText}>
                        • Ne partagez JAMAIS votre clé API publiquement{'\n'}
                        • Utilisez uniquement HTTPS (HTTP rejeté){'\n'}
                        • Stockez la clé dans une variable d&apos;environnement, pas dans le code source{'\n'}
                        • En cas de compromission, contactez immédiatement le support
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ─── 3. Endpoint ─── */}
                <Text style={styles.h1}>3. Endpoint — Soumission de lead</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={styles.badge}>POST</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Courier', marginLeft: 8, color: colors.dark }}>
                        {meta.baseUrl}/api/v1/partners/leads
                    </Text>
                </View>

                <Text style={styles.p}>
                    Soumet un nouveau lead qualifié dans le pipeline de {org.name}. Le lead est automatiquement validé, enregistré avec sa preuve de consentement RGPD, et routé vers le bon territoire si applicable.
                </Text>

                <View style={styles.divider} />

                {/* ─── 4. Schéma JSON ─── */}
                <Text style={styles.h1}>4. Schéma JSON détaillé</Text>
                <Text style={styles.p}>
                    Le corps de la requête doit être un objet JSON conforme au schéma suivant :
                </Text>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.cellHeader, width: '22%' }}>Champ</Text>
                        <Text style={{ ...styles.cellHeader, width: '12%' }}>Type</Text>
                        <Text style={{ ...styles.cellHeader, width: '10%' }}>Requis</Text>
                        <Text style={{ ...styles.cellHeader, width: '56%' }}>Description</Text>
                    </View>
                    {[
                        ['nom', 'string', '✅', 'Nom du prospect (min. 2 caractères)'],
                        ['prenom', 'string', '✅', 'Prénom du prospect (min. 2 caractères)'],
                        ['email', 'string', '✅', 'Email valide du prospect'],
                        ['telephone', 'string', '✅', 'Numéro de téléphone (min. 6 caractères)'],
                        ['adresse', 'string', '✅', 'Adresse postale — rue et numéro (min. 3 car.)'],
                        ['codePostal', 'string', '✅', 'Code postal 5 chiffres (utilisé pour le routage vers l\'agence)'],
                        ['ville', 'string', '✅', 'Ville du prospect (min. 2 caractères)'],
                        ['formationSouhaitee', 'string', '✅', 'Formation / examen demandé (min. 2 caractères)'],
                        ['sourceUrl', 'URL', '✅', 'URL de collecte du consentement (preuve Qualiopi)'],
                        ['consentDate', 'ISO 8601', '✅', 'Date/heure du consentement (ex: 2026-02-11T10:00:00Z)'],
                        ['consentText', 'string', '✅', 'Texte exact du consentement présenté au prospect (min. 10 car.)'],
                        ['message', 'string', '—', 'Message libre du prospect'],
                        ['dateReponse', 'ISO 8601', '—', 'Date de réponse du lead (ex: 2026-02-12T14:30:00Z)'],
                        ['externalId', 'string', '—', 'Votre identifiant interne pour le suivi'],
                    ].map(([field, type, req, desc], i) => (
                        <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                            <Text style={{ ...styles.cellCode, width: '22%' }}>{field}</Text>
                            <Text style={{ ...styles.cell, width: '12%', fontSize: 7.5 }}>{type}</Text>
                            <Text style={{ ...styles.cell, width: '10%', textAlign: 'center' }}>{req}</Text>
                            <Text style={{ ...styles.cell, width: '56%' }}>{desc}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.boxTitle}>ℹ️ Conformité RGPD — Champs obligatoires</Text>
                    <Text style={styles.boxText}>
                        Les champs sourceUrl, consentDate et consentText sont obligatoires pour garantir la conformité RGPD et Qualiopi. Ils constituent la preuve de consentement du prospect et sont conservés à des fins d&apos;audit.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Documentation API — {org.name} × {partner.companyName}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>
            </Page>

            {/* ═══════════════════════════════════════════════════════
                PAGE 4 — RÉPONSES + CODES D'ERREUR
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                {/* ─── 5. Réponses ─── */}
                <Text style={styles.h1}>5. Codes de réponse</Text>

                <Text style={styles.h2}>Réponse succès (201 Created)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeLine}>{'{'}</Text>
                    <Text style={styles.codeLine}>  &quot;success&quot;: true,</Text>
                    <Text style={styles.codeLine}>  &quot;leadId&quot;: &quot;clxyz1234567890&quot;,</Text>
                    <Text style={styles.codeComment}>  // ID unique du lead créé</Text>
                    <Text style={styles.codeLine}>  &quot;dispatched&quot;: true,</Text>
                    <Text style={styles.codeComment}>  // Le lead a été routé vers un territoire</Text>
                    <Text style={styles.codeLine}>  &quot;targetOrg&quot;: &quot;Agence Paris Nord&quot;,</Text>
                    <Text style={styles.codeComment}>  // Nom de l&apos;agence assignée (si routé)</Text>
                    <Text style={styles.codeLine}>  &quot;status&quot;: &quot;RECEIVED&quot;</Text>
                    <Text style={styles.codeLine}>{'}'}</Text>
                </View>

                <Text style={styles.h2}>Codes d&apos;erreur</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.cellHeader, width: '12%' }}>Code</Text>
                        <Text style={{ ...styles.cellHeader, width: '25%' }}>Signification</Text>
                        <Text style={{ ...styles.cellHeader, width: '63%' }}>Description / Action</Text>
                    </View>
                    {[
                        ['201', 'Created', 'Lead créé avec succès. Conservez le leadId pour le suivi.'],
                        ['400', 'Bad Request', 'Le JSON est invalide ou des champs requis sont manquants. Consultez le champ "details" de la réponse.'],
                        ['401', 'Unauthorized', 'Header X-API-KEY absent. Ajoutez votre clé API dans le header.'],
                        ['403', 'Forbidden', 'Clé API invalide ou compte partenaire non activé. Vérifiez votre clé ou contactez le support.'],
                        ['429', 'Too Many Requests', `Rate limit dépassé (${partner.rateLimit} req/h). Attendez avant de réessayer.`],
                        ['500', 'Server Error', 'Erreur interne. Réessayez dans quelques instants ou contactez le support.'],
                    ].map(([code, label, desc], i) => (
                        <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                            <Text style={{ ...styles.cell, width: '12%', fontWeight: 'bold', color: Number(code) >= 400 ? colors.error : colors.success }}>{code}</Text>
                            <Text style={{ ...styles.cell, width: '25%', fontWeight: 'bold' }}>{label}</Text>
                            <Text style={{ ...styles.cell, width: '63%' }}>{desc}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.h2}>Réponse erreur de validation (400)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeLine}>{'{'}</Text>
                    <Text style={styles.codeLine}>  &quot;error&quot;: &quot;Validation échouée&quot;,</Text>
                    <Text style={styles.codeLine}>  &quot;details&quot;: {'{'}</Text>
                    <Text style={styles.codeLine}>    &quot;email&quot;: [&quot;Invalid email&quot;],</Text>
                    <Text style={styles.codeLine}>    &quot;codePostal&quot;: [&quot;Code postal invalide&quot;],</Text>
                    <Text style={styles.codeLine}>    &quot;consentDate&quot;: [&quot;Date de consentement requise&quot;]</Text>
                    <Text style={styles.codeLine}>  {'}'}</Text>
                    <Text style={styles.codeLine}>{'}'}</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Documentation API — {org.name} × {partner.companyName}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>
            </Page>

            {/* ═══════════════════════════════════════════════════════
                PAGE 5 — EXEMPLES DE CODE
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                <Text style={styles.h1}>6. Exemples de code</Text>

                {/* JavaScript / Node.js */}
                <Text style={styles.h2}>JavaScript / Node.js (fetch)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeComment}>// Envoi d&apos;un lead via fetch (Node.js 18+ / navigateur)</Text>
                    <Text style={styles.codeLine}>{''}</Text>
                    <Text style={styles.codeHighlight}>const response = await fetch(</Text>
                    <Text style={styles.codeLine}>  &quot;{meta.baseUrl}/api/v1/partners/leads&quot;,</Text>
                    <Text style={styles.codeLine}>  {'{'}</Text>
                    <Text style={styles.codeLine}>    method: &quot;POST&quot;,</Text>
                    <Text style={styles.codeLine}>    headers: {'{'}</Text>
                    <Text style={styles.codeLine}>      &quot;Content-Type&quot;: &quot;application/json&quot;,</Text>
                    <Text style={styles.codeHighlight}>      &quot;X-API-KEY&quot;: process.env.POLYX_API_KEY,</Text>
                    <Text style={styles.codeLine}>    {'}'},</Text>
                    <Text style={styles.codeLine}>    body: JSON.stringify({'{'}</Text>
                    <Text style={styles.codeLine}>      nom: &quot;Martin&quot;,</Text>
                    <Text style={styles.codeLine}>      prenom: &quot;Sophie&quot;,</Text>
                    <Text style={styles.codeLine}>      email: &quot;sophie.martin@example.com&quot;,</Text>
                    <Text style={styles.codeLine}>      telephone: &quot;0698765432&quot;,</Text>
                    <Text style={styles.codeLine}>      adresse: &quot;45 avenue Jean Jaurès&quot;,</Text>
                    <Text style={styles.codeLine}>      codePostal: &quot;69001&quot;,</Text>
                    <Text style={styles.codeLine}>      ville: &quot;Lyon&quot;,</Text>
                    <Text style={styles.codeLine}>      formationSouhaitee: &quot;Développeur Web&quot;,</Text>
                    <Text style={styles.codeLine}>      sourceUrl: &quot;https://votre-site.fr/contact&quot;,</Text>
                    <Text style={styles.codeLine}>      consentDate: new Date().toISOString(),</Text>
                    <Text style={styles.codeLine}>      consentText: &quot;J&apos;accepte que mes données soient transmises...&quot;,</Text>
                    <Text style={styles.codeLine}>    {'}'}),</Text>
                    <Text style={styles.codeLine}>  {'}'}</Text>
                    <Text style={styles.codeLine}>);</Text>
                    <Text style={styles.codeLine}>{''}</Text>
                    <Text style={styles.codeHighlight}>const result = await response.json();</Text>
                    <Text style={styles.codeLine}>console.log(result.leadId);</Text>
                    <Text style={styles.codeComment}>// =&gt; &quot;clxyz1234567890&quot;</Text>
                </View>

                {/* Python */}
                <Text style={styles.h2}>Python (requests)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeHighlight}>import requests</Text>
                    <Text style={styles.codeHighlight}>from datetime import datetime, timezone</Text>
                    <Text style={styles.codeLine}>{''}</Text>
                    <Text style={styles.codeLine}>response = requests.post(</Text>
                    <Text style={styles.codeLine}>    &quot;{meta.baseUrl}/api/v1/partners/leads&quot;,</Text>
                    <Text style={styles.codeLine}>    headers={'{'}</Text>
                    <Text style={styles.codeLine}>        &quot;Content-Type&quot;: &quot;application/json&quot;,</Text>
                    <Text style={styles.codeHighlight}>        &quot;X-API-KEY&quot;: os.environ[&quot;POLYX_API_KEY&quot;],</Text>
                    <Text style={styles.codeLine}>    {'}'},</Text>
                    <Text style={styles.codeLine}>    json={'{'}</Text>
                    <Text style={styles.codeLine}>        &quot;nom&quot;: &quot;Durand&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;prenom&quot;: &quot;Pierre&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;email&quot;: &quot;pierre.durand@example.com&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;telephone&quot;: &quot;0556789012&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;adresse&quot;: &quot;8 place des Quinconces&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;codePostal&quot;: &quot;33000&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;ville&quot;: &quot;Bordeaux&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;formationSouhaitee&quot;: &quot;Data Analyst&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;sourceUrl&quot;: &quot;https://votre-site.fr/form&quot;,</Text>
                    <Text style={styles.codeLine}>        &quot;consentDate&quot;: datetime.now(timezone.utc).isoformat(),</Text>
                    <Text style={styles.codeLine}>        &quot;consentText&quot;: &quot;J&apos;accepte le traitement...&quot;,</Text>
                    <Text style={styles.codeLine}>    {'}'}</Text>
                    <Text style={styles.codeLine}>)</Text>
                    <Text style={styles.codeLine}>{''}</Text>
                    <Text style={styles.codeHighlight}>data = response.json()</Text>
                    <Text style={styles.codeLine}>print(f&quot;Lead créé: {'{'}data[&apos;leadId&apos;]{'}'}&quot;)</Text>
                </View>

                {/* PHP */}
                <Text style={styles.h2}>PHP (cURL)</Text>
                <View style={styles.codeBlock}>
                    <Text style={styles.codeHighlight}>$ch = curl_init();</Text>
                    <Text style={styles.codeLine}>curl_setopt_array($ch, [</Text>
                    <Text style={styles.codeLine}>  CURLOPT_URL =&gt; &quot;{meta.baseUrl}/api/v1/partners/leads&quot;,</Text>
                    <Text style={styles.codeLine}>  CURLOPT_POST =&gt; true,</Text>
                    <Text style={styles.codeLine}>  CURLOPT_RETURNTRANSFER =&gt; true,</Text>
                    <Text style={styles.codeLine}>  CURLOPT_HTTPHEADER =&gt; [</Text>
                    <Text style={styles.codeLine}>    &quot;Content-Type: application/json&quot;,</Text>
                    <Text style={styles.codeHighlight}>    &quot;X-API-KEY: &quot; . $_ENV[&quot;POLYX_API_KEY&quot;],</Text>
                    <Text style={styles.codeLine}>  ],</Text>
                    <Text style={styles.codeLine}>  CURLOPT_POSTFIELDS =&gt; json_encode([</Text>
                    <Text style={styles.codeLine}>    &quot;nom&quot; =&gt; &quot;Moreau&quot;, &quot;prenom&quot; =&gt; &quot;Julie&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;email&quot; =&gt; &quot;julie@example.com&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;telephone&quot; =&gt; &quot;0240123456&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;adresse&quot; =&gt; &quot;3 cours des 50 Otages&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;codePostal&quot; =&gt; &quot;44000&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;ville&quot; =&gt; &quot;Nantes&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;formationSouhaitee&quot; =&gt; &quot;UX Design&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;sourceUrl&quot; =&gt; &quot;https://votre-site.fr&quot;,</Text>
                    <Text style={styles.codeLine}>    &quot;consentDate&quot; =&gt; date(&apos;c&apos;),</Text>
                    <Text style={styles.codeLine}>    &quot;consentText&quot; =&gt; &quot;Consentement au traitement...&quot;</Text>
                    <Text style={styles.codeLine}>  ])</Text>
                    <Text style={styles.codeLine}>]);</Text>
                    <Text style={styles.codeHighlight}>$result = json_decode(curl_exec($ch), true);</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Documentation API — {org.name} × {partner.companyName}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>
            </Page>

            {/* ═══════════════════════════════════════════════════════
                PAGE 6 — RATE LIMITING + RGPD + BONNES PRATIQUES
            ═══════════════════════════════════════════════════════ */}
            <Page size="A4" style={styles.page}>
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                {/* ─── 7. Rate Limiting ─── */}
                <Text style={styles.h1}>7. Rate Limiting</Text>
                <Text style={styles.p}>
                    Votre compte est limité à {partner.rateLimit} requêtes par heure. Ce quota se réinitialise chaque heure.
                </Text>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.cellHeader, width: '40%' }}>Paramètre</Text>
                        <Text style={{ ...styles.cellHeader, width: '60%' }}>Valeur</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cell, width: '40%' }}>Limite par heure</Text>
                        <Text style={{ ...styles.cell, width: '60%', fontWeight: 'bold' }}>{partner.rateLimit} requêtes</Text>
                    </View>
                    <View style={styles.tableRowAlt}>
                        <Text style={{ ...styles.cell, width: '40%' }}>Fenêtre de reset</Text>
                        <Text style={{ ...styles.cell, width: '60%' }}>1 heure glissante</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cell, width: '40%' }}>Réponse en cas de dépassement</Text>
                        <Text style={{ ...styles.cell, width: '60%' }}>HTTP 429 Too Many Requests</Text>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.boxTitle}>💡 Astuce</Text>
                    <Text style={styles.boxText}>
                        Si vous avez besoin d&apos;un quota plus élevé, contactez-nous pour discuter d&apos;un upgrade de votre plan partenaire.
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ─── 8. Conformité RGPD ─── */}
                <Text style={styles.h1}>8. Conformité RGPD</Text>
                <Text style={styles.p}>
                    En tant que partenaire, vous êtes Sous-Traitant au sens du RGPD (Art. 28). Chaque lead doit obligatoirement inclure :
                </Text>

                <View style={styles.warningBox}>
                    <Text style={styles.boxTitle}>📋 Obligations RGPD — Checklist</Text>
                    <Text style={styles.boxText}>
                        ☐ sourceUrl — L&apos;URL exacte où le prospect a rempli le formulaire{'\n'}
                        ☐ consentDate — La date/heure ISO 8601 du consentement{'\n'}
                        ☐ consentText — Le texte exact du consentement présenté{'\n'}
                        ☐ Le prospect doit avoir été informé de l&apos;identité de {org.name}{'\n'}
                        ☐ Le prospect doit connaître ses droits (accès, rectification, effacement)
                    </Text>
                </View>

                <Text style={styles.p}>
                    Toute preuve de consentement est conservée dans nos systèmes pour une durée conforme au DPA signé. Un lead sans preuve de consentement valide sera automatiquement rejeté (erreur 400).
                </Text>

                <View style={styles.divider} />

                {/* ─── 9. Bonnes pratiques ─── */}
                <Text style={styles.h1}>9. Bonnes pratiques</Text>

                <View style={styles.successBox}>
                    <Text style={styles.boxTitle}>✅ À FAIRE</Text>
                    <Text style={styles.boxText}>
                        • Stockez votre clé API dans une variable d&apos;environnement{'\n'}
                        • Validez les données côté client avant l&apos;envoi{'\n'}
                        • Implémentez un retry avec backoff exponentiel (429, 500, 503){'\n'}
                        • Conservez le leadId retourné pour le suivi{'\n'}
                        • Envoyez des leads &quot;frais&quot; (moins de 72h){'\n'}
                        • Utilisez un externalId pour le rapprochement avec votre CRM
                    </Text>
                </View>

                <View style={styles.errorBox}>
                    <Text style={styles.boxTitle}>❌ À NE PAS FAIRE</Text>
                    <Text style={styles.boxText}>
                        • Coder la clé API en dur dans le code source{'\n'}
                        • Envoyer des leads sans consentement explicite{'\n'}
                        • Dépasser volontairement le rate limit{'\n'}
                        • Envoyer le même lead en doublon{'\n'}
                        • Transmettre des données sensibles (santé, religion, etc.)
                    </Text>
                </View>

                <View style={styles.divider} />

                {/* ─── 10. Support ─── */}
                <Text style={styles.h1}>10. Support technique</Text>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={{ ...styles.cellHeader, width: '30%' }}>Canal</Text>
                        <Text style={{ ...styles.cellHeader, width: '70%' }}>Contact</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cell, width: '30%' }}>Email support</Text>
                        <Text style={{ ...styles.cell, width: '70%' }}>{org.supportEmail || `support@${org.name.toLowerCase().replace(/\s+/g, '')}.fr`}</Text>
                    </View>
                    <View style={styles.tableRowAlt}>
                        <Text style={{ ...styles.cell, width: '30%' }}>Référence partenaire</Text>
                        <Text style={{ ...styles.cellCode, width: '70%' }}>{partner.apiKeyPrefix}</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={{ ...styles.cell, width: '30%' }}>Horaires</Text>
                        <Text style={{ ...styles.cell, width: '70%' }}>Lundi — Vendredi, 9h — 18h (CET)</Text>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.boxTitle}>📧 Pour toute question</Text>
                    <Text style={styles.boxText}>
                        Mentionnez toujours votre préfixe de clé API ({partner.apiKeyPrefix}) et le leadId concerné dans vos demandes de support pour un traitement rapide.
                    </Text>
                </View>

                <Text style={{ ...styles.p, marginTop: 20, textAlign: 'center', color: colors.textMuted, fontSize: 8 }}>
                    — Fin de la documentation —{'\n'}
                    Document généré le {meta.generatedAt} par {org.name} — v1.0{'\n'}
                    CONFIDENTIEL — Ne pas diffuser sans autorisation
                </Text>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Documentation API — {org.name} × {partner.companyName}</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
