
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Register font (optional, using standard Helvetica for now to ensure compatibility)
// Font.register({ family: 'Roboto', src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Regular.ttf' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        fontSize: 11,
        color: '#334155', // slate-700
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#2563eb', // blue-600
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    brand: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b', // slate-800
    },
    subBrand: {
        fontSize: 10,
        color: '#64748b', // slate-500
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 5,
    },
    reference: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 20,
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    text: {
        lineHeight: 1.5,
        marginBottom: 5,
        textAlign: 'justify',
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    bulletPoint: {
        width: 10,
        fontSize: 14,
        color: '#2563eb',
    },
    listContent: {
        flex: 1,
    },
    infoGrid: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc', // slate-50
        padding: 10,
        borderRadius: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0', // slate-200
    },
    infoColumn: {
        flex: 1,
        paddingRight: 10,
    },
    label: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#64748b',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#94a3b8', // slate-400
        fontSize: 9,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
    },
});

interface ProgramPdfProps {
    program: any; // Using any for flexibility with Prisma type
}

export const ProgramPdf = ({ program }: ProgramPdfProps) => {
    // Parsing content if JSON
    let contentText = '';
    if (typeof program.contenu === 'string') {
        contentText = program.contenu;
    } else if (program.contenu && typeof program.contenu === 'object') {
        contentText = program.contenu.text || JSON.stringify(program.contenu);
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brand}>POLYX ERP</Text>
                        <Text style={styles.subBrand}>Organisme de Formation & CFA</Text>
                    </View>
                    <View>
                        <Text style={{ fontSize: 10, textAlign: 'right', color: '#64748b' }}>Fiche Programme</Text>
                        <Text style={{ fontSize: 10, textAlign: 'right', color: '#64748b' }}>Qualiopi Ready</Text>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{program.title}</Text>
                <Text style={styles.reference}>Réf: {program.reference}</Text>

                {/* Info Grid (Key Details) */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoColumn}>
                        <Text style={styles.label}>Durée</Text>
                        <Text style={styles.value}>{program.dureeHeures}h {program.dureeJours > 0 ? `(${program.dureeJours} jours)` : ''}</Text>

                        <Text style={styles.label}>Modalité</Text>
                        <Text style={styles.value}>{program.modalite}</Text>
                    </View>
                    <View style={styles.infoColumn}>
                        <Text style={styles.label}>Tarif Inter</Text>
                        <Text style={styles.value}>{program.tarifInter ? `${program.tarifInter} € HT` : 'Sur devis'}</Text>

                        <Text style={styles.label}>Tarif Intra</Text>
                        <Text style={styles.value}>{program.tarifIntra ? `${program.tarifIntra} € HT` : 'Sur devis'}</Text>
                    </View>
                    <View style={styles.infoColumn}>
                        <Text style={styles.label}>Public Cible</Text>
                        <Text style={[styles.value, { fontSize: 10, fontWeight: 'normal' }]}>{program.publicCible || 'Non spécifié'}</Text>
                    </View>
                </View>

                {/* Objectives (Qualiopi) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Objectifs Pédagogiques</Text>
                    {program.objectifs && Array.isArray(program.objectifs) && program.objectifs.length > 0 ? (
                        program.objectifs.map((obj: string, i: number) => (
                            <View key={i} style={styles.listItem}>
                                <Text style={styles.bulletPoint}>•</Text>
                                <Text style={[styles.text, styles.listContent]}>{obj}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.text}>Aucun objectif défini.</Text>
                    )}
                </View>

                {/* Prerequisites */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Prérequis</Text>
                    <Text style={styles.text}>{program.prerequis || 'Aucun prérequis technique.'}</Text>
                </View>

                {/* Content (Syllabus) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Programme Détaillé</Text>
                    <Text style={styles.text}>{contentText || 'Programme détaillé sur demande.'}</Text>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Document généré automatiquement via Polyx ERP • {program.organization?.name || 'Notre Organisme'} • Siret: {program.organization?.siret || 'N/A'} • NDA: {program.organization?.ndaNumber || 'N/A'}
                </Text>
            </Page>
        </Document>
    );
};
