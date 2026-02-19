import { PrismaClient, LeadStatus, LeadSource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Leads...');

    // 1. Get CFA
    const cfa = await prisma.organization.findFirst({ where: { type: 'CFA' } });
    if (cfa) {
        console.log(`🎯 Found CFA: ${cfa.name} - Injecting Leads...`);
        await createLeads(cfa.id, 'CFA', [
            { nom: 'Martin', prenom: 'Lucas', formation: 'BTS SIO', status: LeadStatus.NEW, source: LeadSource.WEBSITE_FORM, score: 85 },
            { nom: 'Dubois', prenom: 'Emma', formation: 'Bachelor Marketing', status: LeadStatus.A_RAPPELER, source: LeadSource.TIKTOK_ADS, score: 60 },
            { nom: 'Leroy', prenom: 'Thomas', formation: 'CAP Boulanger', status: LeadStatus.RDV_PLANIFIE, source: LeadSource.FACEBOOK_ADS, score: 90 },
            { nom: 'Moreau', prenom: 'Chloé', formation: 'BTS NDRC', status: LeadStatus.NE_REPONDS_PAS, source: LeadSource.GOOGLE_ADS, score: 45 },
            { nom: 'Petit', prenom: 'Nathan', formation: 'BTS MCO', status: LeadStatus.PAS_INTERESSE, source: LeadSource.OTHER, score: 20 },
            { nom: 'Lemoine', prenom: 'Sophie', formation: 'Bachelor Design', status: LeadStatus.NEW, source: LeadSource.WEBSITE_FORM, score: 70 },
            { nom: 'Rousseau', prenom: 'Hugo', formation: 'BTS CI', status: LeadStatus.DISPATCHED, source: LeadSource.LINKEDIN_ADS, score: 55 },
        ]);
    } else {
        console.log('❌ No CFA Organization found. Run `npm run seed` first.');
    }

    // 2. Get OF
    const of = await prisma.organization.findFirst({ where: { type: 'OF_STANDARD', name: { contains: 'Sud' } } }); // Target specific OF if multiple
    if (of) {
        console.log(`🎯 Found OF: ${of.name} - Injecting Leads...`);
        await createLeads(of.id, 'OF', [
            { nom: 'Garcia', prenom: 'Maria', formation: 'Excel Avancé', status: LeadStatus.NEW, source: LeadSource.LINKEDIN_ADS, score: 75 },
            { nom: 'Roux', prenom: 'Paul', formation: 'SST Recyclage', status: LeadStatus.A_RAPPELER, source: LeadSource.MANUAL, score: 55 },
            { nom: 'Fournier', prenom: 'Julie', formation: 'Management', status: LeadStatus.RDV_PLANIFIE, source: LeadSource.WEBSITE_FORM, score: 88 },
            { nom: 'Girard', prenom: 'Michel', formation: 'Anglais Pro', status: LeadStatus.DISPATCHED, source: LeadSource.REFERRAL, score: 65 },
        ]);
    } else {
        console.log('❌ No OF Organization found. Run `npm run seed` first.');
    }
}

async function createLeads(orgId: string, type: string, data: any[]) {
    // Find an admin user for assignment (optional)
    const admin = await prisma.membership.findFirst({
        where: { organizationId: orgId, role: { code: 'ADMIN' } },
        include: { user: true }
    });

    let count = 0;
    for (const l of data) {
        // Avoid duplicates
        const email = `${l.prenom.toLowerCase()}.${l.nom.toLowerCase()}@test.com`;
        const existing = await prisma.lead.findFirst({ where: { email, organizationId: orgId } });
        if (existing) continue;

        const lead = await prisma.lead.create({
            data: {
                organizationId: orgId,
                nom: l.nom,
                prenom: l.prenom,
                email: email,
                telephone: '0612345678',
                status: l.status,
                source: l.source,
                formationSouhaitee: l.formation,
                score: l.score,
                assignedToId: admin?.userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });

        // Add proper consent
        await prisma.leadConsent.create({
            data: {
                leadId: lead.id,
                consentGiven: true,
                consentText: 'J\'accepte la politique de confidentialité.',
                consentMethod: 'CHECKBOX',
                legalBasis: 'CONSENT',
                ipAddress: '127.0.0.1'
            }
        });
        count++;
    }
    console.log(`✅ ${count} leads injected for ${type} (assigned to ${admin?.user.nom || 'Unassigned'})`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
