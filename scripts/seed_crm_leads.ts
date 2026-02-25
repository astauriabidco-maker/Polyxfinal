import { PrismaClient, LeadSource, LeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Ajout de leads CRM de test (statuts post-RDV)...\n');

    const orgs = await prisma.organization.findMany({
        where: { isActive: true },
        include: { sites: { where: { isActive: true }, take: 1 } },
    });

    for (const org of orgs) {
        const isCFA = org.type === 'CFA';
        const siteId = org.sites[0]?.id || null;

        console.log(`🏢 ${org.name} (${org.type})`);

        const crmLeads = isCFA ? [
            // CFA: Leads dans les différentes étapes apprentissage
            { nom: 'Vasseur', prenom: 'Antoine', email: `crm1-${org.id.slice(-4)}@test.com`, telephone: '0699000001', source: LeadSource.EVENT, status: LeadStatus.RDV_PLANIFIE, formationSouhaitee: 'BTS MCO Alternance', dateRdv: new Date('2026-03-01T09:00:00') },
            { nom: 'Renard', prenom: 'Jade', email: `crm2-${org.id.slice(-4)}@test.com`, telephone: '0699000002', source: LeadSource.WEBSITE_FORM, status: LeadStatus.RDV_NON_HONORE, formationSouhaitee: 'Titre Pro Dev Web', dateRdv: new Date('2026-02-15T10:00:00') },
            { nom: 'Picard', prenom: 'Léo', email: `crm3-${org.id.slice(-4)}@test.com`, telephone: '0699000003', source: LeadSource.PARTNER_API, status: LeadStatus.COURRIERS_ENVOYES, formationSouhaitee: 'Bachelor RH Alternance', notes: 'CV envoyé à 5 entreprises. En cours de prospection.' },
            { nom: 'Chevalier', prenom: 'Emma', email: `crm4-${org.id.slice(-4)}@test.com`, telephone: '0699000004', source: LeadSource.EVENT, status: LeadStatus.COURRIERS_ENVOYES, formationSouhaitee: 'CAP Cuisine', notes: 'Cherche restaurant ou traiteur en alternance.' },
            { nom: 'Marchand', prenom: 'Noah', email: `crm5-${org.id.slice(-4)}@test.com`, telephone: '0699000005', source: LeadSource.GOOGLE_ADS, status: LeadStatus.COURRIERS_RECUS, formationSouhaitee: 'BTS SIO', notes: 'Employeur trouvé: Tech Solutions SARL. Contact RH: Marie Dupont.' },
            { nom: 'Duval', prenom: 'Inès', email: `crm6-${org.id.slice(-4)}@test.com`, telephone: '0699000006', source: LeadSource.WEBSITE_FORM, status: LeadStatus.NEGOCIATION, formationSouhaitee: 'Master Management', notes: 'CERFA en cours de validation. OPCO: ATLAS. Numéro dossier: OP-2026-1234' },
            { nom: 'Perrin', prenom: 'Rayan', email: `crm7-${org.id.slice(-4)}@test.com`, telephone: '0699000007', source: LeadSource.REFERRAL, status: LeadStatus.CONVERTI, formationSouhaitee: 'Titre Pro Commerce', convertedAt: new Date('2026-02-10'), notes: 'Contrat signé avec Carrefour. OPCO Commerce validé.' },
            { nom: 'Caron', prenom: 'Lina', email: `crm8-${org.id.slice(-4)}@test.com`, telephone: '0699000008', source: LeadSource.FACEBOOK_ADS, status: LeadStatus.PROBLEMES_SAV, formationSouhaitee: 'BTS NDRC', notes: 'Rupture période essai chez l\'employeur. Recherche nouveau contrat.' },
            { nom: 'Brun', prenom: 'Sacha', email: `crm9-${org.id.slice(-4)}@test.com`, telephone: '0699000009', source: LeadSource.EVENT, status: LeadStatus.PERDU, formationSouhaitee: 'CAP Pâtisserie', lostReason: 'Pas d\'employeur trouvé dans la zone.' },
        ] : [
            // OF: Leads dans les étapes formation continue
            { nom: 'Germain', prenom: 'Vincent', email: `crm1-${org.id.slice(-4)}@test.com`, telephone: '0699100001', source: LeadSource.GOOGLE_ADS, status: LeadStatus.RDV_PLANIFIE, formationSouhaitee: 'Management d\'équipe', dateRdv: new Date('2026-03-05T14:00:00') },
            { nom: 'Collet', prenom: 'Sylvie', email: `crm2-${org.id.slice(-4)}@test.com`, telephone: '0699100002', source: LeadSource.LINKEDIN_ADS, status: LeadStatus.COURRIERS_ENVOYES, formationSouhaitee: 'Gestion de projet', notes: 'Devis envoyé: 2500€ HT pour 3 jours. Convention en attente.' },
            { nom: 'Maillard', prenom: 'François', email: `crm3-${org.id.slice(-4)}@test.com`, telephone: '0699100003', source: LeadSource.REFERRAL, status: LeadStatus.COURRIERS_RECUS, formationSouhaitee: 'Excel Avancé', notes: 'Convention signée. En attente accord OPCO.' },
            { nom: 'Poirier', prenom: 'Anne', email: `crm4-${org.id.slice(-4)}@test.com`, telephone: '0699100004', source: LeadSource.MANUAL, status: LeadStatus.NEGOCIATION, formationSouhaitee: 'Communication pro', notes: 'Demande prise en charge Pôle Emploi. Dossier AIF en cours.' },
            { nom: 'Leclerc', prenom: 'Patrice', email: `crm5-${org.id.slice(-4)}@test.com`, telephone: '0699100005', source: LeadSource.WEBSITE_FORM, status: LeadStatus.CONVERTI, formationSouhaitee: 'Leadership', convertedAt: new Date('2026-02-12'), notes: 'Inscription validée. Session mars 2026.' },
            { nom: 'Aubert', prenom: 'Caroline', email: `crm6-${org.id.slice(-4)}@test.com`, telephone: '0699100006', source: LeadSource.FACEBOOK_ADS, status: LeadStatus.PERDU, formationSouhaitee: 'Comptabilité', lostReason: 'Budget insuffisant, reporté à 2027.' },
        ];

        for (const lead of crmLeads) {
            await prisma.lead.create({
                data: {
                    organizationId: org.id,
                    siteId: siteId,
                    source: lead.source,
                    email: lead.email,
                    nom: lead.nom,
                    prenom: lead.prenom,
                    telephone: lead.telephone,
                    status: lead.status,
                    formationSouhaitee: lead.formationSouhaitee,
                    notes: lead.notes || null,
                    dateRdv: lead.dateRdv || null,
                    convertedAt: lead.convertedAt || null,
                    lostReason: lead.lostReason || null,
                },
            });
        }
        console.log(`   ✅ ${crmLeads.length} leads CRM créés\n`);
    }

    // Stats
    const crmStatuses = ['RDV_PLANIFIE', 'RDV_NON_HONORE', 'COURRIERS_ENVOYES', 'COURRIERS_RECUS', 'NEGOCIATION', 'CONVERTI', 'PROBLEMES_SAV', 'PERDU'];
    const crmCount = await prisma.lead.count({ where: { status: { in: crmStatuses as any } } });
    console.log(`📊 Total leads CRM en base: ${crmCount}`);
    console.log('🎉 Terminé !');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
