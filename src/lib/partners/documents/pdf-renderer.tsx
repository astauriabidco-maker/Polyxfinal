/**
 * MOTEUR DE RENDU PDF DYNAMIQUE — Documents Partenaires
 * =====================================================
 * Prend un DocumentTemplate (depuis la DB) + données contextuelles
 * → Génère un PDF via @react-pdf/renderer
 *
 * Le template contient des sections avec des variables {{xxx}}
 * qui sont remplacées par les données réelles du partenaire et de l'organisme.
 */

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from '@react-pdf/renderer';
import React from 'react';

// ─── Types ────────────────────────────────────────────────────

export interface DocumentData {
    org: {
        name: string;
        siret: string;
        address: string;
        city: string;
        responsable: string;
        nda: string;
    };
    partner: {
        companyName: string;
        formeJuridique: string;
        capitalSocial: string;
        siret: string;
        siren: string;
        rcs: string;
        tvaIntracom: string;
        adresse: string;
        codePostal: string;
        ville: string;
        pays: string;
        representantNom: string;
        representantFonction: string;
        contactName: string;
        contactEmail: string;
        commissionRate: string;
        rateLimit: string;
        iban: string;
        bic: string;
    };
    date: {
        today: string;
        expiryOneYear: string;
    };
}

export interface TemplateSection {
    title: string;
    content: string;
}

export interface TemplatePdfInput {
    title: string;
    sections: TemplateSection[];
    footerText: string;
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
    page: {
        padding: 50,
        paddingBottom: 70,
        fontSize: 9.5,
        fontFamily: 'Helvetica',
        color: '#1e293b',
        lineHeight: 1.6,
    },
    // ─ Header
    header: {
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: '#6d28d9',
        paddingBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e1b4b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 9,
        color: '#64748b',
        fontStyle: 'italic',
    },
    // ─ Sections
    section: {
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 10.5,
        fontWeight: 'bold',
        backgroundColor: '#f1f5f9',
        color: '#4c1d95',
        padding: 6,
        paddingLeft: 10,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#6d28d9',
    },
    sectionContent: {
        paddingHorizontal: 4,
        fontSize: 9.5,
        lineHeight: 1.6,
        textAlign: 'justify',
    },
    // ─ Paragraphe
    paragraph: {
        marginBottom: 6,
    },
    // ─ Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 50,
        right: 50,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
        fontSize: 7,
        color: '#94a3b8',
        textAlign: 'center',
    },
    // ─ Confidential tag
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

// ─── Variable replacement engine ──────────────────────────────

export function replaceVariables(text: string, data: DocumentData): string {
    let result = text;

    // Organisation
    for (const [key, value] of Object.entries(data.org)) {
        result = result.replace(new RegExp(`\\{\\{org\\.${key}\\}\\}`, 'g'), value || '___');
    }

    // Partenaire
    for (const [key, value] of Object.entries(data.partner)) {
        result = result.replace(new RegExp(`\\{\\{partner\\.${key}\\}\\}`, 'g'), value || '___');
    }

    // Dates
    for (const [key, value] of Object.entries(data.date)) {
        result = result.replace(new RegExp(`\\{\\{date\\.${key}\\}\\}`, 'g'), value || '___');
    }

    return result;
}

// ─── Build context from partner + org ─────────────────────────

export function buildDocumentData(partner: any, organization: any): DocumentData {
    const today = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const formatDate = (d: Date) =>
        d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
        org: {
            name: organization.name || '___',
            siret: organization.siret || '___',
            address: [organization.address, organization.zipCode, organization.city].filter(Boolean).join(', ') || '___',
            city: organization.city || '___',
            responsable: organization.responsableName || 'La Direction',
            nda: organization.ndaNumber || '___',
        },
        partner: {
            companyName: partner.companyName || '___',
            formeJuridique: partner.formeJuridique || '___',
            capitalSocial: partner.capitalSocial ? Number(partner.capitalSocial).toLocaleString('fr-FR') : '___',
            siret: partner.siret || '___',
            siren: partner.siren || '___',
            rcs: partner.rcs || '___',
            tvaIntracom: partner.tvaIntracom || '___',
            adresse: partner.adresse || '___',
            codePostal: partner.codePostal || '___',
            ville: partner.ville || '___',
            pays: partner.pays || 'France',
            representantNom: partner.representantNom || '___',
            representantFonction: partner.representantFonction || '___',
            contactName: partner.contactName || '___',
            contactEmail: partner.contactEmail || '___',
            commissionRate: partner.commissionRate ? Number(partner.commissionRate).toString() : '___',
            rateLimit: partner.rateLimit?.toString() || '100',
            iban: partner.iban || '___',
            bic: partner.bic || '___',
        },
        date: {
            today: formatDate(today),
            expiryOneYear: formatDate(expiryDate),
        },
    };
}

// ─── React-PDF Component ──────────────────────────────────────

export function DynamicDocumentPdf({
    template,
    data,
}: {
    template: TemplatePdfInput;
    data: DocumentData;
}) {
    const resolvedTitle = replaceVariables(template.title, data);
    const resolvedFooter = replaceVariables(template.footerText, data);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Confidential tag */}
                <Text style={styles.confidentialTag}>CONFIDENTIEL</Text>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{resolvedTitle}</Text>
                    <Text style={styles.subtitle}>
                        {data.org.name} — Généré le {data.date.today}
                    </Text>
                </View>

                {/* Sections */}
                {template.sections.map((section: TemplateSection, i: number) => {
                    const resolvedContent = replaceVariables(section.content, data);
                    const paragraphs = resolvedContent.split('\n').filter((p: string) => p.trim().length > 0);

                    return (
                        <View key={i} style={styles.section} wrap={true}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <View style={styles.sectionContent}>
                                {paragraphs.map((p: string, j: number) => (
                                    <Text key={j} style={styles.paragraph}>{p.trim()}</Text>
                                ))}
                            </View>
                        </View>
                    );
                })}

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text>{resolvedFooter.replace('{{page}}', '').replace('{{pages}}', '')}</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
