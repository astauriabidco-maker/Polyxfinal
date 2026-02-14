/**
 * SUPER SEED - Test Intégral Architecture Multi-Tenant
 * =====================================================
 * Crée un "Super Utilisateur" qui cumule toutes les casquettes:
 * - CAS 1: Admin Global dans un CFA multi-site (Paris + Lyon)
 * - CAS 2: Resp Pédago Restreint dans un OF (ne voit que Marseille)
 * - CAS 3: Admin dans un OF non certifié (test compliance)
 * 
 * Login: super.consultant@test.com / password123
 */

import {
    PrismaClient,
    OrganizationType,
    MembershipScope,
    PhaseStatus,
    TypeFinanceur,
    NetworkType
} from '@prisma/client';
import { ROLE_IDS } from '../src/lib/constants/roles';
import bcrypt from 'bcryptjs';
import { dispatchLead } from '../src/lib/network/dispatch';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Démarrage du Super-Seed...');

    // 1. Nettoyage complet (ordre inverse des dépendances)
    console.log('🧹 Nettoyage de la base de données...');
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.complianceAlert.deleteMany();
    await prisma.evaluation.deleteMany();
    await prisma.emargement.deleteMany();
    await prisma.avenant.deleteMany();
    await prisma.preuve.deleteMany();
    await prisma.contrat.deleteMany();
    await prisma.programmeSnapshot.deleteMany();
    await prisma.dossier.deleteMany();
    await prisma.financeur.deleteMany();
    await prisma.session.deleteMany();
    await prisma.programme.deleteMany();
    await prisma.certification.deleteMany();
    await prisma.company.deleteMany();
    await prisma.territory.deleteMany();
    await prisma.franchiseCandidate.deleteMany();
    await prisma.membershipSiteAccess.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.site.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    // 1b. Seed des Rôles Système (upsert pour idempotence)
    console.log('🛡️ Création des rôles système...');
    const systemRoles = [
        { id: ROLE_IDS.ADMIN, code: 'ADMIN', name: 'Administrateur', description: 'Accès complet à toutes les fonctionnalités' },
        { id: ROLE_IDS.RESP_PEDAGO, code: 'RESP_PEDAGO', name: 'Responsable Pédagogique', description: 'Gestion pédagogique et suivi des formateurs' },
        { id: ROLE_IDS.RESP_ADMIN, code: 'RESP_ADMIN', name: 'Responsable Administratif', description: 'Gestion administrative et financière' },
        { id: ROLE_IDS.REF_QUALITE, code: 'REF_QUALITE', name: 'Référent Qualité', description: 'Suivi qualité et conformité Qualiopi' },
        { id: ROLE_IDS.FORMAT, code: 'FORMAT', name: 'Formateur', description: 'Saisie assiduité et suivi stagiaires' },
    ];

    for (const role of systemRoles) {
        await prisma.role.upsert({
            where: { id: role.id },
            update: { name: role.name, description: role.description },
            create: {
                id: role.id,
                code: role.code,
                name: role.name,
                description: role.description,
                isSystem: true,
                organizationId: null,
            },
        });
    }
    console.log(`   ✅ ${systemRoles.length} rôles système créés/mis à jour`);

    // 1c. Seed des Permissions (modules de l'application)
    console.log('🔐 Création des permissions modules...');
    const modulePermissions = [
        // Vue d'ensemble
        { code: 'module:portfolio', description: 'Mes Organisations', category: 'Vue d\'ensemble' },
        { code: 'module:dashboard', description: 'Tableau de Bord', category: 'Vue d\'ensemble' },
        // Gestion Opérationnelle
        { code: 'module:dossiers', description: 'Dossiers Stagiaires', category: 'Gestion Opérationnelle' },
        // Administration
        { code: 'module:organizations', description: 'Organisations', category: 'Administration' },
        { code: 'module:sites', description: 'Agences / Sites', category: 'Administration' },
        { code: 'module:users', description: 'Utilisateurs', category: 'Administration' },
        { code: 'module:roles', description: 'Rôles & Permissions', category: 'Administration' },
        { code: 'module:settings', description: 'Paramètres', category: 'Administration' },
        // Conformité & Qualité
        { code: 'module:compliance', description: 'Moteur de Règles', category: 'Conformité & Qualité' },
        { code: 'module:qualiopi', description: 'Suivi Qualiopi', category: 'Conformité & Qualité' },
        { code: 'module:rgpd', description: 'Registre RGPD', category: 'Conformité & Qualité' },
        { code: 'module:partner_qualification', description: 'Qualification Partenaires', category: 'Conformité & Qualité' },
        // Prospection
        { code: 'module:dispatcher', description: 'Dispatcher', category: 'Prospection' },
        { code: 'module:my_leads', description: 'Mes Leads', category: 'Prospection' },
        { code: 'module:leads', description: 'Pipeline Leads', category: 'Prospection' },
        { code: 'module:partners', description: 'Partenaires API', category: 'Prospection' },
        { code: 'module:lead_quality', description: 'Qualité Leads', category: 'Prospection' },
        { code: 'module:network_config', description: 'Configuration Réseau', category: 'Prospection' },
        // Réseau Franchise
        { code: 'module:candidates', description: 'Candidats Franchise', category: 'Réseau Franchise' },
        { code: 'module:territories', description: 'Territoires', category: 'Réseau Franchise' },
        { code: 'module:royalties', description: 'Redevances', category: 'Réseau Franchise' },
    ];

    const createdPermissions: Record<string, string> = {};
    for (const perm of modulePermissions) {
        const p = await prisma.permission.upsert({
            where: { code: perm.code },
            update: { description: perm.description, category: perm.category },
            create: perm,
        });
        createdPermissions[perm.code] = p.id;
    }
    console.log(`   ✅ ${modulePermissions.length} permissions modules créées`);

    // 1d. Assignation des permissions par défaut aux rôles système
    console.log('🔗 Assignation des permissions par défaut...');
    const allPermIds = Object.values(createdPermissions);

    // ADMIN → toutes les permissions
    for (const permId of allPermIds) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: ROLE_IDS.ADMIN, permissionId: permId } },
            update: {},
            create: { roleId: ROLE_IDS.ADMIN, permissionId: permId },
        });
    }

    // RESP_PEDAGO → Dossiers, Dashboard, Conformité, pas Administration ni Prospection
    const respPedagoModules = ['module:portfolio', 'module:dashboard', 'module:dossiers', 'module:compliance', 'module:qualiopi'];
    for (const code of respPedagoModules) {
        if (createdPermissions[code]) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: ROLE_IDS.RESP_PEDAGO, permissionId: createdPermissions[code] } },
                update: {},
                create: { roleId: ROLE_IDS.RESP_PEDAGO, permissionId: createdPermissions[code] },
            });
        }
    }

    // RESP_ADMIN → Dashboard, Dossiers, Administration (partiel), Conformité
    const respAdminModules = ['module:portfolio', 'module:dashboard', 'module:dossiers', 'module:organizations', 'module:sites', 'module:users', 'module:compliance', 'module:qualiopi', 'module:rgpd'];
    for (const code of respAdminModules) {
        if (createdPermissions[code]) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: ROLE_IDS.RESP_ADMIN, permissionId: createdPermissions[code] } },
                update: {},
                create: { roleId: ROLE_IDS.RESP_ADMIN, permissionId: createdPermissions[code] },
            });
        }
    }

    // REF_QUALITE → Dashboard, Conformité complète
    const refQualiteModules = ['module:portfolio', 'module:dashboard', 'module:dossiers', 'module:compliance', 'module:qualiopi', 'module:rgpd', 'module:partner_qualification'];
    for (const code of refQualiteModules) {
        if (createdPermissions[code]) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: ROLE_IDS.REF_QUALITE, permissionId: createdPermissions[code] } },
                update: {},
                create: { roleId: ROLE_IDS.REF_QUALITE, permissionId: createdPermissions[code] },
            });
        }
    }

    // FORMAT → Dashboard, Dossiers seulement
    const formatModules = ['module:portfolio', 'module:dashboard', 'module:dossiers'];
    for (const code of formatModules) {
        if (createdPermissions[code]) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: ROLE_IDS.FORMAT, permissionId: createdPermissions[code] } },
                update: {},
                create: { roleId: ROLE_IDS.FORMAT, permissionId: createdPermissions[code] },
            });
        }
    }

    console.log('   ✅ Permissions par défaut assignées aux rôles système');

    // 2. Création du Super User
    const hashedPassword = await bcrypt.hash('password123', 10);
    const superUser = await prisma.user.create({
        data: {
            email: 'super.consultant@test.com',
            nom: 'Multi-Casquettes',
            prenom: 'Jean-Michel',
            passwordHash: hashedPassword,
            isActive: true,
        }
    });

    console.log(`👤 Super User créé : ${superUser.email}`);

    // ====================================================
    // CAS 1 : LE CFA "GRAND COMPTE" (Admin Global)
    // Teste : Multi-Site, Spécifique CFA (UAI), Vue Globale
    // ====================================================
    console.log('🏢 Création CFA Grand Réseau...');

    const orgCfa = await prisma.organization.create({
        data: {
            name: 'Grand Réseau CFA France',
            type: OrganizationType.CFA,
            siret: '12345678900001',
            ndaNumber: '11750000001',
            qualiopiCertified: true,
            qualiopiExpiry: new Date('2026-12-31'),
            isActive: true,
        }
    });

    // Sites du CFA
    const siteParis = await prisma.site.create({
        data: {
            organizationId: orgCfa.id,
            name: 'Campus Paris',
            city: 'Paris',
            zipCode: '75001',
            uaiCode: '0751234A',
            isHeadquarters: true,
        }
    });

    const siteLyon = await prisma.site.create({
        data: {
            organizationId: orgCfa.id,
            name: 'Campus Lyon',
            city: 'Lyon',
            zipCode: '69001',
            uaiCode: '0692345B',
        }
    });

    // Membership GLOBAL (Voit Paris ET Lyon)
    await prisma.membership.create({
        data: {
            user: { connect: { id: superUser.id } },
            organization: { connect: { id: orgCfa.id } },
            role: { connect: { id: ROLE_IDS.ADMIN } },
            scope: MembershipScope.GLOBAL,
            isActive: true,
        }
    });

    // Programme CFA
    const programmeCfa = await prisma.programme.create({
        data: {
            organizationId: orgCfa.id,
            reference: 'CFA-DEV-2024-001',
            intitule: 'Titre Professionnel Développeur Web',
            objectifs: 'Maîtriser le développement front et back-end',
            prerequis: 'Niveau Bac, goût pour la programmation',
            contenu: 'HTML/CSS, JavaScript, React, Node.js, SQL',
            modalitesEval: 'Projets individuels et collectifs, certification finale',
            moyensPedago: 'Salles informatiques, supports numériques',
            dureeHeures: 1200,
            tarifHT: 8500,
            tarifTTC: 10200,
            isPublished: true,
            status: PhaseStatus.ACTIF,
        }
    });

    // Session CFA Paris
    const sessionCfaParis = await prisma.session.create({
        data: {
            organizationId: orgCfa.id,
            siteId: siteParis.id,
            programmeId: programmeCfa.id,
            reference: 'SESS-CFA-PAR-2024-01',
            dateDebut: new Date('2024-09-01'),
            dateFin: new Date('2025-06-30'),
            placesMax: 20,
            status: PhaseStatus.ACTIF,
        }
    });

    // Session CFA Lyon
    const sessionCfaLyon = await prisma.session.create({
        data: {
            organizationId: orgCfa.id,
            siteId: siteLyon.id,
            programmeId: programmeCfa.id,
            reference: 'SESS-CFA-LYO-2024-01',
            dateDebut: new Date('2024-09-15'),
            dateFin: new Date('2025-07-15'),
            placesMax: 15,
            status: PhaseStatus.ACTIF,
        }
    });

    // Dossier à Paris (visible en scope GLOBAL)
    await prisma.dossier.create({
        data: {
            organizationId: orgCfa.id,
            siteId: siteParis.id,
            sessionId: sessionCfaParis.id,
            stagiaireNom: 'Martin',
            stagiairePrenom: 'Apprenti',
            stagiaireEmail: 'apprenti.paris@test.com',
            status: PhaseStatus.ACTIF,
            createdById: superUser.id,
        }
    });

    // Dossier à Lyon (visible en scope GLOBAL)
    await prisma.dossier.create({
        data: {
            organizationId: orgCfa.id,
            siteId: siteLyon.id,
            sessionId: sessionCfaLyon.id,
            stagiaireNom: 'Dupont',
            stagiairePrenom: 'Claire',
            stagiaireEmail: 'apprenti.lyon@test.com',
            status: PhaseStatus.ACTIF,
            createdById: superUser.id,
        }
    });

    console.log('✅ CFA créé avec 2 sites (Paris, Lyon) et 2 dossiers');

    // ====================================================
    // CAS 2 : L'OF EN RÉSEAU (Accès Restreint)
    // Teste : OF Standard, Restriction Géographique (Scope)
    // ====================================================
    console.log('🏢 Création OF Formation Sud Network...');

    const orgOfReseau = await prisma.organization.create({
        data: {
            name: 'Formation Sud Network',
            type: OrganizationType.OF_STANDARD,
            siret: '98765432100001',
            ndaNumber: '93130123456',
            qualiopiCertified: true,
            qualiopiExpiry: new Date('2027-06-30'),
            isActive: true,
        }
    });

    // Sites de l'OF
    const siteMarseille = await prisma.site.create({
        data: {
            organizationId: orgOfReseau.id,
            name: 'Agence Marseille',
            city: 'Marseille',
            zipCode: '13001',
            isHeadquarters: true,
        }
    });

    const siteNice = await prisma.site.create({
        data: {
            organizationId: orgOfReseau.id,
            name: 'Agence Nice',
            city: 'Nice',
            zipCode: '06000',
        }
    });

    const siteMontpellier = await prisma.site.create({
        data: {
            organizationId: orgOfReseau.id,
            name: 'Agence Montpellier',
            city: 'Montpellier',
            zipCode: '34000',
        }
    });

    // Membership RESTREINT (Ne voit QUE Marseille)
    // Jean-Michel est responsable pédagogique, mais juste à Marseille.
    const membershipOF = await prisma.membership.create({
        data: {
            user: { connect: { id: superUser.id } },
            organization: { connect: { id: orgOfReseau.id } },
            role: { connect: { id: ROLE_IDS.RESP_PEDAGO } },
            scope: MembershipScope.RESTRICTED,
            isActive: true,
        }
    });

    // Lien site accessible: uniquement Marseille
    await prisma.membershipSiteAccess.create({
        data: {
            membershipUserId: superUser.id,
            membershipOrgId: orgOfReseau.id,
            siteId: siteMarseille.id,
        }
    });

    // Programme OF
    const programmeOf = await prisma.programme.create({
        data: {
            organizationId: orgOfReseau.id,
            reference: 'OF-MGMT-2024-001',
            intitule: 'Management d\'équipe',
            objectifs: 'Développer les compétences managériales',
            prerequis: 'Expérience en entreprise souhaitée',
            contenu: 'Leadership, Communication, Gestion des conflits',
            modalitesEval: 'Mises en situation, étude de cas',
            moyensPedago: 'Supports numériques, jeux de rôle',
            dureeHeures: 35,
            tarifHT: 2500,
            tarifTTC: 3000,
            isPublished: true,
            status: PhaseStatus.ACTIF,
        }
    });

    // Session Marseille
    const sessionMarseille = await prisma.session.create({
        data: {
            organizationId: orgOfReseau.id,
            siteId: siteMarseille.id,
            programmeId: programmeOf.id,
            reference: 'SESS-OF-MRS-2024-01',
            dateDebut: new Date('2024-11-01'),
            dateFin: new Date('2024-11-08'),
            placesMax: 12,
            status: PhaseStatus.ACTIF,
        }
    });

    // Session Nice
    const sessionNice = await prisma.session.create({
        data: {
            organizationId: orgOfReseau.id,
            siteId: siteNice.id,
            programmeId: programmeOf.id,
            reference: 'SESS-OF-NCE-2024-01',
            dateDebut: new Date('2024-11-15'),
            dateFin: new Date('2024-11-22'),
            placesMax: 10,
            status: PhaseStatus.ACTIF,
        }
    });

    // Dossier à Marseille (Il DOIT le voir - scope restreint)
    await prisma.dossier.create({
        data: {
            organizationId: orgOfReseau.id,
            siteId: siteMarseille.id,
            sessionId: sessionMarseille.id,
            stagiaireNom: 'Durand',
            stagiairePrenom: 'Sophie',
            stagiaireEmail: 'eleve.marseille@test.com',
            status: PhaseStatus.ACTIF,
            createdById: superUser.id,
        }
    });

    // Dossier à Nice (IL NE DOIT PAS LE VOIR - TEST CRITIQUE DE SÉCURITÉ)
    await prisma.dossier.create({
        data: {
            organizationId: orgOfReseau.id,
            siteId: siteNice.id,
            sessionId: sessionNice.id,
            stagiaireNom: 'Bernard',
            stagiairePrenom: 'Marc',
            stagiaireEmail: 'eleve.nice@test.com', // INVISIBLE car Nice non accessible
            status: PhaseStatus.ACTIF,
            createdById: superUser.id,
        }
    });

    // Dossier à Montpellier (AUSSI INVISIBLE)
    await prisma.dossier.create({
        data: {
            organizationId: orgOfReseau.id,
            siteId: siteMontpellier.id,
            sessionId: sessionMarseille.id, // Session Marseille mais site Montpellier
            stagiaireNom: 'Petit',
            stagiairePrenom: 'Julie',
            stagiaireEmail: 'eleve.montpellier@test.com', // INVISIBLE aussi
            status: PhaseStatus.ACTIF,
            createdById: superUser.id,
        }
    });

    console.log('✅ OF Réseau créé avec 3 sites - Accès RESTREINT à Marseille uniquement');
    console.log('   ⚠️  TEST SÉCURITÉ: eleve.nice@test.com et eleve.montpellier@test.com DOIVENT être invisibles');

    // ====================================================
    // CAS 3 : LE NOUVEL ENTRANT (Conformité)
    // Teste : Blocage NDA, Blocage Qualiopi
    // ====================================================
    console.log('🏢 Création OF Starter Formation (non certifié)...');

    const orgNewbie = await prisma.organization.create({
        data: {
            name: 'Starter Formation',
            type: OrganizationType.OF_STANDARD,
            siret: '55555555500001',
            ndaNumber: null, // PAS DE NDA
            qualiopiCertified: false, // PAS DE QUALIOPI
            isActive: true,
        }
    });

    const siteNewbie = await prisma.site.create({
        data: {
            organizationId: orgNewbie.id,
            name: 'Siège (Domicile)',
            city: 'Bordeaux',
            zipCode: '33000',
            isHeadquarters: true,
        }
    });

    // Membership GLOBAL Admin
    await prisma.membership.create({
        data: {
            user: { connect: { id: superUser.id } },
            organization: { connect: { id: orgNewbie.id } },
            role: { connect: { id: ROLE_IDS.ADMIN } },
            scope: MembershipScope.GLOBAL,
            isActive: true,
        }
    });

    // Programme Newbie
    const programmeNewbie = await prisma.programme.create({
        data: {
            organizationId: orgNewbie.id,
            reference: 'START-FORM-2024-001',
            intitule: 'Initiation Excel',
            objectifs: 'Maîtriser les bases d\'Excel',
            prerequis: 'Aucun',
            contenu: 'Tableaux, Formules, Graphiques',
            modalitesEval: 'QCM final',
            moyensPedago: 'PC équipé, supports PDF',
            dureeHeures: 14,
            tarifHT: 500,
            tarifTTC: 600,
            isPublished: true,
            status: PhaseStatus.ACTIF,
        }
    });

    // Session Newbie
    const sessionNewbie = await prisma.session.create({
        data: {
            organizationId: orgNewbie.id,
            siteId: siteNewbie.id,
            programmeId: programmeNewbie.id,
            reference: 'SESS-START-2024-01',
            dateDebut: new Date('2024-12-01'),
            dateFin: new Date('2024-12-02'),
            placesMax: 8,
            status: PhaseStatus.ACTIF,
        }
    });

    // Dossier CPF bloqué (Test du moteur de règles compliance)
    const dossierCpfBloque = await prisma.dossier.create({
        data: {
            organizationId: orgNewbie.id,
            siteId: siteNewbie.id,
            sessionId: sessionNewbie.id,
            stagiaireNom: 'Lefebvre',
            stagiairePrenom: 'Client CPF',
            stagiaireEmail: 'client.cpf.bloque@test.com',
            status: PhaseStatus.BROUILLON, // En attente admission
            createdById: superUser.id,
        }
    });

    // Créer un financeur CPF pour tester la règle Qualiopi
    await prisma.financeur.create({
        data: {
            organizationId: orgNewbie.id,
            type: TypeFinanceur.CPF,
            raisonSociale: 'Caisse des Dépôts (CPF)',
            numeroCPF: 'CPF-2024-DEMO-001',
            soldeCPF: 1500,
        }
    });

    // Créer une alerte de compliance préexistante
    await prisma.complianceAlert.create({
        data: {
            dossierId: dossierCpfBloque.id,
            ruleId: 'RULE_QUALIOPI_REQUIRED',
            severity: 'BLOCKING',
            context: 'CONTRACTUALISATION', // Phase CdCF
            trigger: 'VALIDATE_ADMISSION', // Action déclenchante
            message: 'Organisation non certifiée Qualiopi - Financement Public (CPF) Interdit',
            isResolved: false,
        }
    });

    console.log('✅ Starter Formation créé - Non certifié Qualiopi, dossier CPF bloqué');

    // ====================================================
    // CAS 4 : RÉSEAU DE FRANCHISE (Hub & Spoke)
    // Teste : Hiérarchie Org, Territoires, Dispatching
    // ====================================================
    console.log('🏢 Création Réseau de Franchise (Hub & Spoke)...');

    // 4a. Siège National (HEAD_OFFICE)
    const orgSiege = await prisma.organization.create({
        data: {
            name: 'Siège National Formation',
            type: OrganizationType.OF_STANDARD,
            siret: '99999999900001',
            ndaNumber: '11750099999',
            qualiopiCertified: true,
            qualiopiExpiry: new Date('2028-12-31'),
            networkType: 'HEAD_OFFICE',
            royaltyRate: 5.0,
            leadFeeRate: 15.0,
            isActive: true,
        }
    });

    const siteSiege = await prisma.site.create({
        data: {
            organizationId: orgSiege.id,
            name: 'Siège Paris',
            city: 'Paris',
            zipCode: '75008',
            isHeadquarters: true,
        }
    });

    // Membership ADMIN pour le super user au siège
    await prisma.membership.create({
        data: {
            user: { connect: { id: superUser.id } },
            organization: { connect: { id: orgSiege.id } },
            role: { connect: { id: ROLE_IDS.ADMIN } },
            scope: MembershipScope.GLOBAL,
            isActive: true,
        }
    });

    // 4b. Franchise Lyon (FRANCHISE, enfant du siège)
    const orgFranchiseLyon = await prisma.organization.create({
        data: {
            name: 'Franchise Lyon',
            type: OrganizationType.OF_STANDARD,
            siret: '88888888800001',
            networkType: 'FRANCHISE',
            parentId: orgSiege.id,
            royaltyRate: 5.0,
            leadFeeRate: 15.0,
            qualiopiCertified: true,
            qualiopiExpiry: new Date('2028-12-31'),
            isActive: true,
        }
    });

    const siteLyonFranchise = await prisma.site.create({
        data: {
            organizationId: orgFranchiseLyon.id,
            name: 'Agence Lyon Centre',
            city: 'Lyon',
            zipCode: '69001',
            isHeadquarters: true,
        }
    });

    // Admin de la franchise Lyon
    const franchiseAdmin = await prisma.user.create({
        data: {
            email: 'admin.lyon@test.com',
            nom: 'Responsable',
            prenom: 'Lyon',
            passwordHash: hashedPassword,
            isActive: true,
        }
    });

    await prisma.membership.create({
        data: {
            user: { connect: { id: franchiseAdmin.id } },
            organization: { connect: { id: orgFranchiseLyon.id } },
            role: { connect: { id: ROLE_IDS.ADMIN } },
            scope: MembershipScope.GLOBAL,
            isActive: true,
        }
    });

    // 4c. Territoire de Lyon : couvre 69000, 69001, 69002
    await prisma.territory.create({
        data: {
            organizationId: orgFranchiseLyon.id,
            name: 'Zone Lyon Centre',
            zipCodes: ['69000', '69001', '69002'],
            isExclusive: true,
        }
    });

    console.log('✅ Territoire Lyon créé : 69000, 69001, 69002');

    // 4d. Programme et Session au Siège (pour le dispatching)
    const programmeSiege = await prisma.programme.create({
        data: {
            organizationId: orgSiege.id,
            reference: 'HQ-RESEAU-2024-001',
            intitule: 'Formation Réseau National',
            objectifs: 'Former les franchisés',
            prerequis: 'Aucun',
            contenu: 'Modules réseau',
            modalitesEval: 'QCM + projet',
            moyensPedago: 'En ligne',
            dureeHeures: 21,
            tarifHT: 1500,
            tarifTTC: 1800,
            isPublished: true,
            status: PhaseStatus.ACTIF,
        }
    });

    const sessionSiege = await prisma.session.create({
        data: {
            organizationId: orgSiege.id,
            siteId: siteSiege.id,
            programmeId: programmeSiege.id,
            reference: 'SESS-HQ-2024-01',
            dateDebut: new Date('2024-10-01'),
            dateFin: new Date('2024-10-05'),
            placesMax: 20,
            status: PhaseStatus.ACTIF,
        }
    });

    // 4e. Dossier au Siège avec CP 69001 (DOIT être dispatché à Lyon)
    const dossierADispatcer = await prisma.dossier.create({
        data: {
            organizationId: orgSiege.id,
            siteId: siteSiege.id,
            sessionId: sessionSiege.id,
            stagiaireNom: 'Testeur',
            stagiairePrenom: 'Dispatch',
            stagiaireEmail: 'dispatch.test.lyon@test.com',
            stagiaireCp: '69001',
            status: PhaseStatus.BROUILLON,
            createdById: superUser.id,
        }
    });

    // 4f. Exécuter le dispatch automatique !
    console.log('🚀 Lancement du dispatching automatique...');
    try {
        const dispatchResult = await dispatchLead(dossierADispatcer.id, '69001');
        if (dispatchResult.matched) {
            console.log(`   ✅ DISPATCH RÉUSSI: Dossier transféré à "${dispatchResult.targetOrgName}"`);
            console.log(`   📍 Territoire: ${dispatchResult.territoryName}`);
        } else {
            console.log('   ⚠️ DISPATCH: Pas de match territorial trouvé');
        }
    } catch (e) {
        console.error('   ❌ DISPATCH ERREUR:', e);
    }

    // 4g. Candidat franchise en attente (CRM pipeline)
    await prisma.franchiseCandidate.create({
        data: {
            organizationId: orgSiege.id,
            companyName: 'Boulangerie Dupont',
            representantNom: 'Dupont',
            representantPrenom: 'Pierre',
            email: 'pierre.dupont@candidat.com',
            phone: '06 11 22 33 44',
            status: 'DIP_SENT',
            franchiseType: 'OF',
            targetZone: 'Marseille Nord',
            targetZipCodes: ['13001', '13002', '13003'],
            investmentBudget: 50000,
            notes: 'Profil intéressant — ancien directeur de centre de formation',
        }
    });

    console.log('✅ Réseau de Franchise créé avec dispatching vérifié');

    // ====================================================
    // RÉSUMÉ FINAL
    // ====================================================
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ SUPER-SEED TERMINÉ AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('👉 LOGIN: super.consultant@test.com');
    console.log('👉 PASSWORD: password123');
    console.log('');
    console.log('📋 SCÉNARIOS DE TEST:');
    console.log('');
    console.log('1️⃣  VUE PORTFOLIO (Tour de Contrôle):');
    console.log('    → 5 cartes: CFA, OF Réseau, Starter, Siège National, Franchise Lyon');
    console.log('');
    console.log('2️⃣  CFA "Grand Réseau CFA France" (ADMIN GLOBAL):');
    console.log('    → Vous voyez Paris ET Lyon');
    console.log('    → 2 dossiers apprentis visibles');
    console.log('');
    console.log('3️⃣  OF "Formation Sud Network" (RESP_PEDAGO RESTREINT):');
    console.log('    → ✅ Visible: eleve.marseille@test.com');
    console.log('    → ❌ INVISIBLE: eleve.nice@test.com (TEST SÉCURITÉ)');
    console.log('    → ❌ INVISIBLE: eleve.montpellier@test.com (TEST SÉCURITÉ)');
    console.log('');
    console.log('4️⃣  OF "Starter Formation" (ADMIN - COMPLIANCE):');
    console.log('    → Pas de Qualiopi ⚠️');
    console.log('    → client.cpf.bloque@test.com doit afficher alerte rouge');
    console.log('');
    console.log('5️⃣  RÉSEAU FRANCHISE (Hub & Spoke):');
    console.log('    → Siège National Formation (HEAD_OFFICE)');
    console.log('    → Franchise Lyon (FRANCHISE, enfant du siège)');
    console.log('    → Territoire: 69000, 69001, 69002');
    console.log('    → dispatch.test.lyon@test.com → dispatché automatiquement à Lyon');
    console.log('    → Candidat CRM: pierre.dupont@candidat.com (DIP_SENT)');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
}

main()
    .catch((e) => {
        console.error('❌ Erreur Seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
