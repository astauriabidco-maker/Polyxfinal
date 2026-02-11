
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function testPartnerPipeline() {
    console.log('🏁 Démarrage du test Pipeline Partenaire (Apporteur d\'affaires)');

    // 1. PHASE 1 : Onboarding & Recrutement
    // On va chercher le siège
    const siege = await prisma.organization.findFirst({ where: { networkType: 'HEAD_OFFICE' } });
    if (!siege) throw new Error("Pas de siège trouvé");

    const partnerEmail = 'contact@lead-factory.com';

    // Nettoyage si existe déjà
    await prisma.partner.deleteMany({ where: { contactEmail: partnerEmail } });

    // Création partenaire (Statut PENDING par défaut)
    const apiKey = `pk_test_${crypto.randomBytes(16).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const partner = await prisma.partner.create({
        data: {
            organizationId: siege.id,
            companyName: 'Lead Factory Pro',
            contactName: 'Marc Miller',
            contactEmail: partnerEmail,
            siret: '88877766600011',
            apiKeyHash,
            apiKeyPrefix: apiKey.substring(0, 16),
            status: 'PENDING', // Phase de recrutement
            contractUrl: 'https://docs.google.com/contract_v1'
        }
    });

    console.log(`✅ Phase 1 : Partenaire créé "${partner.companyName}" (PENDING)`);

    // Automation de la validation (Le recrutement est validé)
    await prisma.partner.update({
        where: { id: partner.id },
        data: {
            status: 'ACTIVE',
            contractSignedAt: new Date(),
            dpaSignedAt: new Date() // Conformité RGPD validée
        }
    });
    console.log('✅ Phase 1 : Partenaire activé (Contrat + DPA signés)');

    // 2. PHASE 3 : Acquisition & Smart Routing
    console.log(`🚀 Phase 3 : Envoi d'un lead via API Key: ${apiKey}`);

    // Simulation d'un appel API (On utilise l'endpoint interne simulé)
    // On va injecter un lead avec le CP 13001 (devrait aller vers Marseille Nord créé précédemment)

    // Pour le test on injecte manuellement pour vérifier le dispatcher
    try {
        const payload = {
            email: 'candidat.marseille@gmail.com',
            nom: 'Lecoq',
            prenom: 'Jean',
            codePostal: '13001',
            sourceUrl: 'https://lead-factory.fr/form-of',
            consentDate: new Date().toISOString(),
            consentText: 'J\'accepte que mes données soient transmises à Polyx ERP.'
        };

        // On fait un "fetch" simulé sur notre nouvel API
        // Comme on est en script, on va juste vérifier que Marseille Nord existe
        const targetOrg = await prisma.organization.findFirst({ where: { name: 'Franchise Marseille Nord' } });
        if (!targetOrg) {
            console.log('⚠️ Attention: Franchise Marseille Nord non trouvée (Prisma reset ?). Le lead restera au siège.');
        }

        // --- Execution réelle de la logique d'ingestion ---
        // On crée le lead
        const lead = await prisma.lead.create({
            data: {
                organizationId: siege.id,
                partnerId: partner.id,
                source: 'PARTNER_API',
                email: payload.email,
                nom: payload.nom,
                prenom: payload.prenom,
                codePostal: payload.codePostal,
            }
        });

        console.log(`📥 Lead reçu par le siège (ID: ${lead.id})`);

        // Appel du dispatcher
        const { dispatchLeadToFranchise } = require('../src/lib/prospection/dispatcher');
        const result = await dispatchLeadToFranchise(lead.id, payload.codePostal);

        if (result.matched) {
            console.log(`🎯 SMART ROUTING : Lead envoyé avec succès vers "${result.targetOrgName}" !`);
        } else {
            console.log(`🏢 SIÈGE : Aucun territoire trouvé pour ${payload.codePostal}, le lead reste au siège.`);
        }

        // Vérification de la preuve RGPD (on l'ajoute pour le test)
        await prisma.leadConsent.create({
            data: {
                leadId: lead.id,
                consentGiven: true,
                consentText: payload.consentText,
                consentMethod: 'API_TEST',
                legalBasis: 'consent'
            }
        });
        console.log('⚖️ CONFORMITÉ : Preuve de consentement archivée.');

    } catch (e) {
        console.error('❌ Erreur Test Ingestion:', e);
    }
}

testPartnerPipeline()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
