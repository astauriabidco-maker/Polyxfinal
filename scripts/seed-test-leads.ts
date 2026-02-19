/**
 * SEED — Données de test : Leads Pipeline + CRM
 * ================================================
 * Injecte ~30 leads réalistes répartis sur tous les statuts.
 *
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-test-leads.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// IDs from the database
const ORG_ID = 'cmlqm19hl000mmcy19e1wttof'; // Grand Réseau CFA France
const SITE_PARIS = 'cmlqm19hq000omcy12dmlzmz9';
const SITE_LYON = 'cmlqm19hu000qmcy1n9ywt54n';
const USER_SUPER = 'cmlqm19hg000lmcy1bjw957ug'; // super.consultant@test.com
const USER_LYON = 'cmlqm19k70024mcy13sp1ng9g';  // admin.lyon@test.com

function daysAgo(n: number): Date {
    const d = new Date(); d.setDate(d.getDate() - n); return d;
}
function daysFromNow(n: number): Date {
    const d = new Date(); d.setDate(d.getDate() + n); return d;
}

// Use string literals to avoid Prisma client caching issues
const TEST_LEADS: any[] = [
    // ═══ PIPELINE ═══

    // NEW (3)
    {
        email: 'sophie.martin@gmail.com', nom: 'Martin', prenom: 'Sophie',
        telephone: '06 12 34 56 78', source: 'WEBSITE_FORM', status: 'NEW',
        formationSouhaitee: 'BTS Commerce International', codePostal: '75011', ville: 'Paris',
        message: 'Bonjour, je souhaiterais avoir des renseignements sur votre BTS CI.',
        createdAt: daysAgo(1)
    },

    {
        email: 'karim.benali@hotmail.fr', nom: 'Benali', prenom: 'Karim',
        telephone: '07 65 43 21 09', source: 'PARTNER_API', status: 'NEW',
        formationSouhaitee: 'Bachelor Marketing Digital', codePostal: '69003', ville: 'Lyon',
        message: 'Inscription pour la rentrée de septembre.',
        createdAt: daysAgo(0)
    },

    {
        email: 'lucie.petit@yahoo.fr', nom: 'Petit', prenom: 'Lucie',
        telephone: '06 98 76 54 32', source: 'FACEBOOK_ADS', status: 'NEW',
        formationSouhaitee: 'MBA Management International', codePostal: '75015', ville: 'Paris',
        createdAt: daysAgo(2)
    },

    // DISPATCHED (3)
    {
        email: 'omar.diallo@gmail.com', nom: 'Diallo', prenom: 'Omar',
        telephone: '06 11 22 33 44', source: 'WEBSITE_FORM', status: 'DISPATCHED',
        formationSouhaitee: 'BTS Gestion PME', codePostal: '75020', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[17/02/2026 09:15] 📋 Lead dispatché automatiquement → Campus Paris (CP 75)',
        createdAt: daysAgo(3)
    },

    {
        email: 'clara.durand@outlook.com', nom: 'Durand', prenom: 'Clara',
        telephone: '07 55 44 33 22', source: 'MANUAL', status: 'DISPATCHED',
        formationSouhaitee: 'Licence Ressources Humaines', codePostal: '69001', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[16/02/2026 14:30] 📋 Lead dispatché → Campus Lyon',
        createdAt: daysAgo(4)
    },

    {
        email: 'thomas.moreau@gmail.com', nom: 'Moreau', prenom: 'Thomas',
        telephone: '06 77 88 99 00', source: 'WEBSITE_FORM', status: 'DISPATCHED',
        formationSouhaitee: 'BTS Comptabilité', codePostal: '75003', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        createdAt: daysAgo(2)
    },

    // A_RAPPELER (3)
    {
        email: 'maria.santos@gmail.com', nom: 'Santos', prenom: 'Maria',
        telephone: '06 22 33 44 55', source: 'WEBSITE_FORM', status: 'A_RAPPELER',
        formationSouhaitee: 'Bachelor Commerce', codePostal: '75012', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, nextCallDate: daysFromNow(1),
        notes: '[15/02/2026 16:00] 🤔 Intéressée — Demande un rappel mercredi matin\n[14/02/2026 10:30] 📞 Premier appel, pas disponible',
        createdAt: daysAgo(5)
    },

    {
        email: 'julien.leroy@outlook.fr', nom: 'Leroy', prenom: 'Julien',
        telephone: '07 11 22 33 44', source: 'GOOGLE_ADS', status: 'A_RAPPELER',
        formationSouhaitee: 'MBA Marketing', codePostal: '69006', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON, nextCallDate: daysFromNow(2),
        notes: '[16/02/2026 11:00] 📞 Demande docs et rappel vendredi',
        createdAt: daysAgo(6)
    },

    {
        email: 'fatou.camara@gmail.com', nom: 'Camara', prenom: 'Fatou',
        telephone: '06 99 88 77 66', source: 'PARTNER_API', status: 'A_RAPPELER',
        formationSouhaitee: 'BTS Communication', codePostal: '75019', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, nextCallDate: daysFromNow(0),
        notes: '[15/02/2026 14:45] 🤔 Hésite entre BTS Com et BTS MUC — rappeler demain',
        createdAt: daysAgo(7)
    },

    // NE_REPONDS_PAS (2)
    {
        email: 'paul.dupuis@free.fr', nom: 'Dupuis', prenom: 'Paul',
        telephone: '06 44 55 66 77', source: 'WEBSITE_FORM', status: 'NE_REPONDS_PAS',
        formationSouhaitee: 'Licence Informatique', codePostal: '75008', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[16/02/2026 10:00] 📵 3ème tentative, messagerie pleine\n[14/02/2026 15:30] 📵 Pas de réponse\n[12/02/2026 09:00] 📵 1er appel',
        createdAt: daysAgo(10)
    },

    {
        email: 'emma.richard@laposte.net', nom: 'Richard', prenom: 'Emma',
        telephone: '07 33 22 11 00', source: 'MANUAL', status: 'NE_REPONDS_PAS',
        formationSouhaitee: 'BTS Tourisme', codePostal: '69002', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[15/02/2026 17:00] 📵 N\'a pas décroché — 2 tentatives',
        createdAt: daysAgo(8)
    },

    // PAS_INTERESSE (2)
    {
        email: 'marc.blanc@gmail.com', nom: 'Blanc', prenom: 'Marc',
        telephone: '06 55 66 77 88', source: 'FACEBOOK_ADS', status: 'PAS_INTERESSE',
        formationSouhaitee: 'BTS MUC', codePostal: '75016', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[14/02/2026 11:00] ❌ Le candidat a choisi un autre organisme (prix)',
        createdAt: daysAgo(12)
    },

    {
        email: 'nadia.khelif@hotmail.com', nom: 'Khelif', prenom: 'Nadia',
        telephone: '07 88 77 66 55', source: 'WEBSITE_FORM', status: 'PAS_INTERESSE',
        formationSouhaitee: 'Bachelor RH', codePostal: '69009', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[13/02/2026 16:30] ❌ Ne souhaite plus poursuivre',
        createdAt: daysAgo(15)
    },

    // ═══ CRM — Post-RDV ═══

    // RDV_PLANIFIE (3)
    {
        email: 'adrien.martinez@gmail.com', nom: 'Martinez', prenom: 'Adrien',
        telephone: '06 33 44 55 66', source: 'WEBSITE_FORM', status: 'RDV_PLANIFIE',
        formationSouhaitee: 'BTS Commerce International', codePostal: '75013', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, dateRdv: daysFromNow(3),
        notes: '[16/02/2026 14:00] 📅 RDV confirmé pour jeudi 14h au campus Paris',
        createdAt: daysAgo(8)
    },

    {
        email: 'sarah.cohen@gmail.com', nom: 'Cohen', prenom: 'Sarah',
        telephone: '07 22 33 44 55', source: 'PARTNER_API', status: 'RDV_PLANIFIE',
        formationSouhaitee: 'MBA Management', codePostal: '69007', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON, dateRdv: daysFromNow(5),
        notes: '[15/02/2026 10:30] 📅 RDV fixé lundi prochain 10h — campus Lyon',
        createdAt: daysAgo(6)
    },

    {
        email: 'maxime.girard@outlook.com', nom: 'Girard', prenom: 'Maxime',
        telephone: '06 66 77 88 99', source: 'WEBSITE_FORM', status: 'RDV_PLANIFIE',
        formationSouhaitee: 'Licence Pro Logistique', codePostal: '75018', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, dateRdv: daysFromNow(1),
        notes: '[17/02/2026 09:00] 📅 RDV demain matin 9h30',
        createdAt: daysAgo(4)
    },

    // RDV_NON_HONORE (1)
    {
        email: 'amina.traore@gmail.com', nom: 'Traoré', prenom: 'Amina',
        telephone: '07 44 55 66 77', source: 'FACEBOOK_ADS', status: 'RDV_NON_HONORE',
        formationSouhaitee: 'BTS Communication', codePostal: '75010', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, dateRdv: daysAgo(2),
        notes: '[15/02/2026 14:00] ❌ Ne s\'est pas présentée au RDV\n[12/02/2026 11:00] 📅 RDV confirmé',
        createdAt: daysAgo(10)
    },

    // COURRIERS_ENVOYES (2)
    {
        email: 'lucas.bernard@gmail.com', nom: 'Bernard', prenom: 'Lucas',
        telephone: '06 88 77 66 55', source: 'WEBSITE_FORM', status: 'COURRIERS_ENVOYES',
        formationSouhaitee: 'BTS Comptabilité Gestion', codePostal: '75005', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[16/02/2026 16:00] 📝 Dossier + convention envoyés par mail\n[14/02/2026 10:00] ✅ RDV positif',
        createdAt: daysAgo(12)
    },

    {
        email: 'ines.morel@yahoo.fr', nom: 'Morel', prenom: 'Inès',
        telephone: '07 99 88 77 66', source: 'MANUAL', status: 'COURRIERS_ENVOYES',
        formationSouhaitee: 'Bachelor Marketing Digital', codePostal: '69004', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[15/02/2026 15:30] 📝 Contrat et RIB envoyés\n[13/02/2026 09:30] ✅ RDV très positif',
        createdAt: daysAgo(14)
    },

    // COURRIERS_RECUS (2)
    {
        email: 'romain.lefevre@gmail.com', nom: 'Lefèvre', prenom: 'Romain',
        telephone: '06 11 33 55 77', source: 'WEBSITE_FORM', status: 'COURRIERS_RECUS',
        formationSouhaitee: 'BTS Gestion PME', codePostal: '75009', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[16/02/2026 10:00] 📬 Dossier complet reçu, contrat signé\n[12/02/2026 14:00] 📝 Documents envoyés',
        createdAt: daysAgo(15)
    },

    {
        email: 'chloe.dubois@hotmail.fr', nom: 'Dubois', prenom: 'Chloé',
        telephone: '07 22 44 66 88', source: 'PARTNER_API', status: 'COURRIERS_RECUS',
        formationSouhaitee: 'Licence RH', codePostal: '69001', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[17/02/2026 08:30] 📬 Contrat signé reçu !\n[14/02/2026 16:00] 📝 Envoi du dossier',
        createdAt: daysAgo(16)
    },

    // NEGOCIATION (2)
    {
        email: 'alexandre.roy@gmail.com', nom: 'Roy', prenom: 'Alexandre',
        telephone: '06 44 66 88 00', source: 'WEBSITE_FORM', status: 'NEGOCIATION',
        formationSouhaitee: 'MBA International Business', codePostal: '75007', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[16/02/2026 17:00] 🤝 Discussion financement — attend OPCO\n[14/02/2026 14:30] 📬 Dossier reçu',
        createdAt: daysAgo(18)
    },

    {
        email: 'yasmine.hamdi@outlook.com', nom: 'Hamdi', prenom: 'Yasmine',
        telephone: '07 33 55 77 99', source: 'GOOGLE_ADS', status: 'NEGOCIATION',
        formationSouhaitee: 'BTS Commerce International', codePostal: '69005', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        notes: '[17/02/2026 11:00] 🤝 Négocie un étalement de paiement',
        createdAt: daysAgo(20)
    },

    // CONVERTI (2)
    {
        email: 'nicolas.garcia@gmail.com', nom: 'Garcia', prenom: 'Nicolas',
        telephone: '06 55 77 99 11', source: 'WEBSITE_FORM', status: 'CONVERTI',
        formationSouhaitee: 'BTS Commerce International', codePostal: '75014', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER, convertedAt: daysAgo(2),
        notes: '[15/02/2026 14:00] 🎉 CONVERTI ! Inscription validée\n[12/02/2026 09:00] 📬 Dossier complet',
        createdAt: daysAgo(25)
    },

    {
        email: 'camille.perrin@laposte.net', nom: 'Perrin', prenom: 'Camille',
        telephone: '07 66 55 44 33', source: 'MANUAL', status: 'CONVERTI',
        formationSouhaitee: 'Bachelor Marketing Digital', codePostal: '69008', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON, convertedAt: daysAgo(5),
        notes: '[12/02/2026 10:00] 🎉 CONVERTI ! Financement OPCO validé',
        createdAt: daysAgo(30)
    },

    // PROBLEMES_SAV (1)
    {
        email: 'hugo.lambert@gmail.com', nom: 'Lambert', prenom: 'Hugo',
        telephone: '06 77 55 33 11', source: 'PARTNER_API', status: 'PROBLEMES_SAV',
        formationSouhaitee: 'BTS Gestion PME', codePostal: '75004', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        notes: '[17/02/2026 10:00] ⚠️ Réclamation : convention non reçue — relance',
        createdAt: daysAgo(22)
    },

    // PERDU (2)
    {
        email: 'lea.fournier@gmail.com', nom: 'Fournier', prenom: 'Léa',
        telephone: '06 88 66 44 22', source: 'WEBSITE_FORM', status: 'PERDU',
        formationSouhaitee: 'MBA Management', codePostal: '75002', ville: 'Paris',
        siteId: SITE_PARIS, assignedToId: USER_SUPER,
        lostReason: 'A choisi un autre organisme (meilleur prix)',
        notes: '[16/02/2026 12:00] ❌ PERDU — a signé chez un concurrent',
        createdAt: daysAgo(28)
    },

    {
        email: 'kevin.meunier@hotmail.fr', nom: 'Meunier', prenom: 'Kévin',
        telephone: '07 99 77 55 33', source: 'GOOGLE_ADS', status: 'PERDU',
        formationSouhaitee: 'Licence Informatique', codePostal: '69003', ville: 'Lyon',
        siteId: SITE_LYON, assignedToId: USER_LYON,
        lostReason: 'Financement refusé par l\'OPCO',
        notes: '[14/02/2026 15:00] ❌ PERDU — OPCO a refusé la prise en charge',
        createdAt: daysAgo(35)
    },
];

async function seedTestLeads() {
    console.log('🚀 Injection des leads de test...\n');

    let created = 0;
    const statusCounts: Record<string, number> = {};

    for (const lead of TEST_LEADS) {
        const { createdAt, ...data } = lead;
        try {
            await prisma.lead.create({
                data: {
                    organizationId: ORG_ID,
                    ...data,
                    createdAt,
                    updatedAt: createdAt,
                },
            });
            created++;
            statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
        } catch (err) {
            console.error(`  ❌ ${lead.email}:`, (err as Error).message?.slice(0, 100));
        }
    }

    // Create RGPD consent for each lead
    const allLeads = await prisma.lead.findMany({
        where: { organizationId: ORG_ID },
        select: { id: true },
    });

    let consents = 0;
    for (const lead of allLeads) {
        const existing = await prisma.leadConsent.findUnique({ where: { leadId: lead.id } });
        if (!existing) {
            await prisma.leadConsent.create({
                data: {
                    leadId: lead.id,
                    consentGiven: true,
                    consentText: 'J\'accepte que mes données soient utilisées pour le traitement de ma demande de formation.',
                    consentMethod: 'web_form',
                    legalBasis: 'consent',
                },
            });
            consents++;
        }
    }

    console.log(`✅ ${created} leads créés :\n`);

    console.log('  ─── PIPELINE ───');
    ['NEW', 'DISPATCHED', 'A_RAPPELER', 'NE_REPONDS_PAS', 'PAS_INTERESSE'].forEach(s =>
        console.log(`  ${s}: ${statusCounts[s] || 0}`)
    );

    console.log('\n  ─── CRM ───');
    ['RDV_PLANIFIE', 'RDV_NON_HONORE', 'COURRIERS_ENVOYES', 'COURRIERS_RECUS', 'NEGOCIATION', 'CONVERTI', 'PROBLEMES_SAV', 'PERDU'].forEach(s =>
        console.log(`  ${s}: ${statusCounts[s] || 0}`)
    );

    console.log(`\n🔐 ${consents} consentements RGPD créés`);
    console.log('\n🎉 Terminé ! Rechargez Pipeline et CRM pour voir les données.');
}

seedTestLeads()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
