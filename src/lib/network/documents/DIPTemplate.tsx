import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Enregistrement de polices si nécessaire (optionnel pour start)
// Font.register({ family: 'Helvetica', fontWeight: 'normal' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#1e293b',
    },
    header: {
        marginBottom: 30,
        borderBottom: 1,
        borderBottomColor: '#3b82f6',
        paddingBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e3a8a',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: '#f1f5f9',
        padding: 5,
        marginBottom: 10,
        color: '#1e40af',
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    label: {
        width: 150,
        fontWeight: 'bold',
        color: '#475569',
    },
    value: {
        flex: 1,
        color: '#1e293b',
    },
    text: {
        lineHeight: 1.5,
        marginBottom: 10,
        textAlign: 'justify',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        borderTop: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
        fontSize: 8,
        color: '#94a3b8',
        textAlign: 'center',
    }
});

interface DIPData {
    candidate: any;
    organization: any;
}

export const DIPTemplate = ({ candidate, organization }: DIPData) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Document d'Information Précontractuel (D.I.P)</Text>
                <Text style={styles.subtitle}>En application de l'article L. 330-3 du Code de Commerce (Loi Doubin)</Text>
            </View>

            {/* Identité du Franchiseur */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. Identité de l'entreprise (Franchiseur)</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Raison Sociale :</Text>
                    <Text style={styles.value}>{organization.name}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>N° SIRET :</Text>
                    <Text style={styles.value}>{organization.siret}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Siège Social :</Text>
                    <Text style={styles.value}>{organization.address || 'Non spécifié'}, {organization.zipCode} {organization.city}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Responsable :</Text>
                    <Text style={styles.value}>{organization.responsableName || 'La Direction'}</Text>
                </View>
            </View>

            {/* Identité du Candidat */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>2. Identité du Candidat</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Candidat :</Text>
                    <Text style={styles.value}>{candidate.representantPrenom} {candidate.representantNom}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Société ou projet :</Text>
                    <Text style={styles.value}>{candidate.companyName}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Email :</Text>
                    <Text style={styles.value}>{candidate.email}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Zone visée :</Text>
                    <Text style={styles.value}>{candidate.targetZone || 'France Entière'}</Text>
                </View>
            </View>

            {/* Texte Légal - Loi Doubin */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>3. Mentions Légales Obligatoires</Text>
                <Text style={styles.text}>
                    Conformément aux dispositions de l'article L.330-3 du Code de commerce, ce document a pour objet de permettre au futur franchisé de s'engager en connaissance de cause en lui fournissant des informations sincères sur le franchiseur et son réseau.
                </Text>
                <Text style={styles.text}>
                    Un délai de 20 jours minimum doit être respecté entre la remise de ce présent document et la signature du contrat définitif ou le versement de toute somme d'argent. Ce document est strictement confidentiel.
                </Text>
            </View>

            {/* Etat du Réseau (Placeholder pour Phase 3) */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>4. État du Réseau et Marché</Text>
                <Text style={styles.text}>
                    Le réseau Polyx ERP est un réseau d'Organismes de Formation et de CFA spécialisés dans le numérique.
                    L'état du marché local et les perspectives de développement font l'objet d'une annexe technique jointe au présent document.
                </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text>Document généré par Polyx ERP Compliance Engine - 2026</Text>
                <Text>Page 1 / 1</Text>
            </View>
        </Page>
    </Document>
);
