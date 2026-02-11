import { prisma } from '@/lib/prisma';

interface DispatchResult {
    matched: boolean;
    leadId: string;
    targetOrgId: string;
    targetOrgName: string;
    territoryId?: string;
    territoryName?: string;
}

/**
 * Dispatche un LEAD du siège vers le franchisé approprié
 * basé sur le code postal.
 */
export async function dispatchLeadToFranchise(
    leadId: string,
    zipCode: string
): Promise<DispatchResult> {
    // 1. Charger le lead avec son organisation
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    networkType: true,
                },
            },
        },
    });

    if (!lead) {
        throw new Error(`Lead introuvable: ${leadId}`);
    }

    const headOfficeId = lead.organizationId;

    // 2. Vérifier que c'est bien une structure de réseau (HEAD_OFFICE)
    if (lead.organization.networkType !== 'HEAD_OFFICE') {
        // Si ce n'est pas un siège, le lead reste là où il est (pas de dispatch réseau)
        return {
            matched: false,
            leadId,
            targetOrgId: headOfficeId,
            targetOrgName: lead.organization.name,
        };
    }

    // 3. Chercher les territoires des franchisés qui couvrent ce CP
    const matchingTerritories = await prisma.territory.findMany({
        where: {
            isActive: true,
            zipCodes: { has: zipCode },
            organization: {
                parentId: headOfficeId,
                isActive: true,
                networkType: { in: ['FRANCHISE', 'SUCCURSALE'] },
            },
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        take: 1,
    });

    // 4. Si match trouvé → transférer au franchisé
    if (matchingTerritories.length > 0) {
        const territory = matchingTerritories[0];
        const targetOrg = territory.organization;

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                organizationId: targetOrg.id,
                notes: lead.notes
                    ? `${lead.notes}\n[System] Dispatché depuis siège via zone ${territory.name}`
                    : `[System] Dispatché depuis siège via zone ${territory.name}`,
            },
        });

        console.log(`[LeadDispatch] ✅ Lead ${leadId} routé vers ${targetOrg.name} (CP: ${zipCode})`);

        return {
            matched: true,
            leadId,
            targetOrgId: targetOrg.id,
            targetOrgName: targetOrg.name,
            territoryId: territory.id,
            territoryName: territory.name,
        };
    }

    // 5. Pas de match → reste au siège
    return {
        matched: false,
        leadId,
        targetOrgId: headOfficeId,
        targetOrgName: lead.organization.name,
    };
}
