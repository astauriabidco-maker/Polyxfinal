/**
 * SCRIPT DE TEST DES SCÉNARIOS COMPLIANCE
 * ========================================
 * Exécute les 3 scénarios de test contre le moteur de règles.
 * 
 * Usage: npx tsx src/lib/compliance/test-scenarios.ts
 */

import { PrismaClient } from '@prisma/client';
import { validateStateChange, setPrismaInstance } from './engine';

const prisma = new PrismaClient();

// Injecter le client Prisma réel
setPrismaInstance(prisma);

async function runScenarios() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 TEST DES SCÉNARIOS COMPLIANCE');
    console.log('='.repeat(70) + '\n');

    // Récupérer les dossiers
    const dossiers = await prisma.dossier.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
            contrats: {
                include: { financeur: true },
            },
        },
    });

    if (dossiers.length === 0) {
        console.log('❌ Aucun dossier trouvé. Exécutez d\'abord: npx prisma db seed');
        return;
    }

    console.log(`📂 ${dossiers.length} dossiers trouvés\n`);

    // ============================================================================
    // SCÉNARIO 1: Happy Path → CLOTURE
    // ============================================================================
    const happyPath = dossiers.find(d => d.stagiairePrenom === 'Alice');
    if (happyPath) {
        console.log('─'.repeat(70));
        console.log('📗 SCÉNARIO 1: Happy Path (Alice Dupont)');
        console.log('─'.repeat(70));
        console.log(`   ID: ${happyPath.id}`);
        console.log(`   Statut actuel: ${happyPath.status}`);
        console.log(`   Assiduité: ${happyPath.tauxAssiduite}%`);
        console.log(`   Certificat généré: ${happyPath.certificatGenere ? '✅' : '❌'}`);

        // Test: Peut-on aller en CLOTURE ?
        console.log('\n   🔍 Test: Transition vers CLOTURE...');
        const result = await validateStateChange(happyPath.id, 'CLOTURE');

        if (result.success) {
            console.log('   ✅ RÉSULTAT: Transition AUTORISÉE');
        } else {
            console.log('   ❌ RÉSULTAT: Transition BLOQUÉE');
            result.errors.forEach(e => console.log(`      → ${e}`));
        }
        console.log(`   📊 Attendu: ✅ PASS | Obtenu: ${result.success ? '✅ PASS' : '❌ FAIL'}\n`);
    }

    // ============================================================================
    // SCÉNARIO 2: The Cheater → Blocage CLOTURE
    // ============================================================================
    const cheater = dossiers.find(d => d.stagiairePrenom === 'Bob');
    if (cheater) {
        console.log('─'.repeat(70));
        console.log('📕 SCÉNARIO 2: The Cheater (Bob Fraudeur)');
        console.log('─'.repeat(70));
        console.log(`   ID: ${cheater.id}`);
        console.log(`   Statut actuel: ${cheater.status}`);
        console.log(`   Assiduité: ${cheater.tauxAssiduite}% ⚠️`);
        console.log(`   Certificat généré: ${cheater.certificatGenere ? '✅' : '❌'}`);

        // Test: Peut-on aller en CLOTURE ?
        console.log('\n   🔍 Test: Transition vers CLOTURE...');
        const result = await validateStateChange(cheater.id, 'CLOTURE');

        if (result.success) {
            console.log('   ⚠️ RÉSULTAT: Transition AUTORISÉE (INATTENDU!)');
        } else {
            console.log('   🚫 RÉSULTAT: Transition BLOQUÉE');
            result.errors.forEach(e => console.log(`      → ${e}`));
        }
        console.log(`   📊 Attendu: 🚫 BLOCK | Obtenu: ${!result.success ? '🚫 BLOCK' : '⚠️ FAIL'}\n`);
    }

    // ============================================================================
    // SCÉNARIO 3: Admin Défaillant → Blocage EN_COURS
    // ============================================================================
    const adminFail = dossiers.find(d => d.stagiairePrenom === 'Charlie');
    if (adminFail) {
        console.log('─'.repeat(70));
        console.log('📙 SCÉNARIO 3: Admin Défaillant (Charlie Bloqué)');
        console.log('─'.repeat(70));
        console.log(`   ID: ${adminFail.id}`);
        console.log(`   Statut actuel: ${adminFail.status}`);
        const contrat = adminFail.contrats[0];
        console.log(`   Contrat signé: ${contrat?.isSigned ? '✅' : '❌'} ⚠️`);
        console.log(`   Financement validé: ${contrat?.accordFinancementRecu ? '✅' : '❌'} ⚠️`);

        // Test: Peut-on démarrer (EN_COURS) ?
        console.log('\n   🔍 Test: Transition vers EN_COURS...');
        const result = await validateStateChange(adminFail.id, 'EN_COURS');

        if (result.success) {
            console.log('   ⚠️ RÉSULTAT: Transition AUTORISÉE (INATTENDU!)');
        } else {
            console.log('   🚫 RÉSULTAT: Transition BLOQUÉE');
            result.errors.forEach(e => console.log(`      → ${e}`));
        }
        console.log(`   📊 Attendu: 🚫 BLOCK | Obtenu: ${!result.success ? '🚫 BLOCK' : '⚠️ FAIL'}\n`);
    }

    // ============================================================================
    // VÉRIFICATION DES COMPLIANCE ALERTS
    // ============================================================================
    console.log('─'.repeat(70));
    console.log('📋 COMPLIANCE ALERTS GÉNÉRÉES');
    console.log('─'.repeat(70));

    const alerts = await prisma.complianceAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    if (alerts.length === 0) {
        console.log('   Aucune alerte générée.\n');
    } else {
        console.log(`   ${alerts.length} alerte(s) en base:\n`);
        alerts.forEach((alert, i) => {
            console.log(`   ${i + 1}. [${alert.severity}] ${alert.ruleId}`);
            console.log(`      Message: ${alert.message}`);
            console.log(`      Dossier: ${alert.dossierId}`);
            console.log(`      Résolue: ${alert.isResolved ? '✅' : '⏳'}`);
            console.log('');
        });
    }

    console.log('='.repeat(70));
    console.log('✅ Tests des scénarios terminés!');
    console.log('='.repeat(70) + '\n');
}

runScenarios()
    .catch((e) => {
        console.error('❌ Erreur:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
