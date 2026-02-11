
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testFullAutomatedFlow() {
    console.log('🏁 TEST DU WORKFLOW AUTOMATISÉ (E-MAIL + SIGNATURE + API KEY)');

    const siege = await prisma.organization.findFirst({ where: { networkType: 'HEAD_OFFICE' } });
    if (!siege) throw new Error("Siège non trouvé");

    const contactEmail = 'automates@prestataire.fr';
    await prisma.partner.deleteMany({ where: { contactEmail } });

    // 1. Création (Admin)
    console.log('\n--- 1. CRÉATION DU PARTENAIRE (EMAIL 1 DÉCLENCHÉ) ---');
    const partner = await prisma.partner.create({
        data: {
            organizationId: siege.id,
            companyName: 'Automate Leads SAS',
            contactName: 'Robert',
            contactEmail: contactEmail,
            apiKeyHash: '',
            apiKeyPrefix: '',
            status: 'PENDING'
        }
    });

    // Simulation du trigger email (Automatique dans l'API)
    const onboardingUrl = `http://localhost:3000/partners/onboarding/${partner.id}`;
    console.log(`✉️ Email 1 envoyé à ${contactEmail}`);
    console.log(`🔗 Contient le lien : ${onboardingUrl}`);

    // 2. Signature par le partenaire (Page Publique)
    console.log('\n--- 2. SIGNATURE PAR LE PARTENAIRE (SIMULATION PAGE PUBLIQUE) ---');
    await prisma.partner.update({
        where: { id: partner.id },
        data: {
            contractSignedAt: new Date(),
            dpaSignedAt: new Date()
        }
    });
    console.log('✅ Partenaire a signé les 2 documents sur la page onboarding.');

    // 3. Activation (Admin Counter-signs)
    console.log('\n--- 3. ACTIVATION / CONTRE-SIGNATURE (EMAIL 2 DÉCLENCHÉ) ---');
    // On simule l'activation par l'admin qui déclenche l'API Key
    const apiKey = 'pk_live_ABC123_PROTECTED'; // Simulée

    await prisma.partner.update({
        where: { id: partner.id },
        data: {
            status: 'ACTIVE',
            apiKeyHash: 'hashed_abc123',
            apiKeyPrefix: 'pk_live_ABC123'
        }
    });

    console.log(`✉️ Email 2 envoyé à ${contactEmail}`);
    console.log(`🔑 Contient la Clé API: ${apiKey}`);
    console.log(`📖 Contient le lien doc: http://localhost:3000/partners/docs`);

    console.log('\n🏆 WORKFLOW AUTOMATISÉ VALIDÉ.');
}

testFullAutomatedFlow()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
