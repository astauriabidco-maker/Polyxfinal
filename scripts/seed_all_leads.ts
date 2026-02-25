import { PrismaClient, LeadSource, LeadStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Données de leads réalistes par type d'organisation
const OF_LEADS = [
    { nom: 'Lemaire', prenom: 'Catherine', email: 'catherine.lemaire@gmail.com', telephone: '0612345001', source: LeadSource.WEBSITE_FORM, status: LeadStatus.NEW, formationSouhaitee: 'Management d\'équipe', message: 'Bonjour, je souhaite une formation en management pour moi et mon adjoint.', origin: 'Site Web' },
    { nom: 'Berger', prenom: 'Philippe', email: 'p.berger@entreprise.fr', telephone: '0612345002', source: LeadSource.MANUAL, status: LeadStatus.A_RAPPELER, formationSouhaitee: 'Excel Avancé', message: 'Demande de devis pour 5 collaborateurs.', origin: 'Appel entrant' },
    { nom: 'Faure', prenom: 'Isabelle', email: 'isabelle.faure@hotmail.com', telephone: '0612345003', source: LeadSource.GOOGLE_ADS, status: LeadStatus.NEW, formationSouhaitee: 'Gestion de projet', message: 'Je cherche une formation certifiante en gestion de projet.', origin: 'Google Ads - Campagne Formation Pro' },
    { nom: 'Mercier', prenom: 'Jean-Paul', email: 'jpmercier@pme-sud.fr', telephone: '0612345004', source: LeadSource.FACEBOOK_ADS, status: LeadStatus.NE_REPONDS_PAS, formationSouhaitee: 'Comptabilité', message: 'Formation comptabilité pour reconversion.', origin: 'Facebook Ads' },
    { nom: 'Andre', prenom: 'Nathalie', email: 'n.andre@outlook.com', telephone: '0612345005', source: LeadSource.REFERRAL, status: LeadStatus.RDV_PLANIFIE, formationSouhaitee: 'Communication professionnelle', message: 'Recommandée par un ancien stagiaire. Intéressée par une formation communication.', origin: 'Bouche à oreille', dateRdv: new Date('2026-03-05T10:00:00') },
    { nom: 'Simon', prenom: 'François', email: 'f.simon@tech-corp.com', telephone: '0612345006', source: LeadSource.LINKEDIN_ADS, status: LeadStatus.NEGOCIATION, formationSouhaitee: 'Leadership', message: 'Formation pour 3 managers. Budget à valider avec la DRH.', origin: 'LinkedIn Ads' },
];

const CFA_LEADS = [
    { nom: 'Blanc', prenom: 'Théo', email: 'theo.blanc@lyceen.fr', telephone: '0612345010', source: LeadSource.EVENT, status: LeadStatus.NEW, formationSouhaitee: 'BTS MCO en alternance', message: 'Je suis en Terminale et je cherche un CFA pour un BTS MCO en alternance.', origin: 'Salon de l\'Etudiant Paris' },
    { nom: 'Nguyen', prenom: 'Linh', email: 'linh.nguyen@mail.com', telephone: '0612345011', source: LeadSource.WEBSITE_FORM, status: LeadStatus.A_RAPPELER, formationSouhaitee: 'Titre Pro Développeur Web', message: 'Reconversion professionnelle, je cherche une alternance en développement web.', origin: 'Site Web CFA' },
    { nom: 'Morel', prenom: 'Axel', email: 'axel.morel@gmail.com', telephone: '0612345012', source: LeadSource.PARTNER_API, status: LeadStatus.DISPATCHED, formationSouhaitee: 'CAP Cuisine', message: 'Profil validé par la plateforme alternance.', origin: 'La Bonne Alternance' },
    { nom: 'Dufour', prenom: 'Camille', email: 'camille.dufour@outlook.fr', telephone: '0612345013', source: LeadSource.GOOGLE_ADS, status: LeadStatus.NEW, formationSouhaitee: 'Bachelor RH', message: 'Je cherche un Bachelor RH en alternance pour la rentrée 2026.', origin: 'Google Ads - Campagne Alternance' },
    { nom: 'Lambert', prenom: 'Maxime', email: 'max.lambert@etudiant.fr', telephone: '0612345014', source: LeadSource.EVENT, status: LeadStatus.RDV_PLANIFIE, formationSouhaitee: 'BTS SIO', message: 'Rencontré au salon, très motivé pour un BTS SIO option SLAM.', origin: 'JPO Campus', dateRdv: new Date('2026-03-10T14:00:00') },
    { nom: 'Bonnet', prenom: 'Clara', email: 'clara.bonnet@yahoo.fr', telephone: '0612345015', source: LeadSource.FACEBOOK_ADS, status: LeadStatus.NE_REPONDS_PAS, formationSouhaitee: 'Titre Pro Commerce', message: 'Intéressée par le commerce en alternance.', origin: 'Facebook Ads - Jeunes' },
];

async function main() {
    console.log('🌱 Ajout de leads de test pour TOUTES les organisations...\n');

    const orgs = await prisma.organization.findMany({
        where: { isActive: true },
        include: { sites: { where: { isActive: true }, take: 3 } },
    });

    console.log(`📊 ${orgs.length} organisations trouvées.\n`);

    for (const org of orgs) {
        const leadTemplates = org.type === 'CFA' ? CFA_LEADS : OF_LEADS;
        const firstSiteId = org.sites[0]?.id || null;

        console.log(`🏢 ${org.name} (${org.type}) — Site: ${org.sites[0]?.name || 'Aucun site'}`);

        const leadsToCreate = leadTemplates.map((lead, i) => ({
            organizationId: org.id,
            siteId: firstSiteId,
            source: lead.source,
            email: `${org.id.slice(-4)}-${lead.email}`,  // Unique email per org
            nom: lead.nom,
            prenom: lead.prenom,
            telephone: lead.telephone,
            status: lead.status,
            formationSouhaitee: lead.formationSouhaitee,
            message: lead.message,
            origin: lead.origin,
            ...(lead.dateRdv ? { dateRdv: lead.dateRdv } : {}),
        }));

        await prisma.lead.createMany({ data: leadsToCreate });
        console.log(`   ✅ ${leadsToCreate.length} leads créés\n`);
    }

    // Stats finales
    const totalLeads = await prisma.lead.count();
    const byOrg = await prisma.lead.groupBy({
        by: ['organizationId'],
        _count: true,
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total leads en base: ${totalLeads}`);
    for (const stat of byOrg) {
        const org = orgs.find(o => o.id === stat.organizationId);
        console.log(`   ${org?.name || stat.organizationId}: ${stat._count} leads`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 Terminé !');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
