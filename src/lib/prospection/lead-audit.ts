import { prisma } from '@/lib/prisma';
import { NiveauAction } from '@prisma/client';

/**
 * Log une action sur un lead dans AuditLog
 */
export async function logLeadAction(
    leadId: string,
    organizationId: string,
    userId: string, // ID de l'utilisateur ou 'SYSTEM'
    userRole: string, // Role de l'utilisateur ou 'SYSTEM'
    action: string, // 'CREATE', 'UPDATE', 'DISPATCH', 'STATUS_CHANGE'
    details: string,
    metadata?: any
) {
    try {
        await prisma.auditLog.create({
            data: {
                organizationId,
                userId, // Si 'SYSTEM', assurez-vous qu'un user SYSTEM existe ou ajustez le modèle AuditLog pour userId nullable
                userRole,
                action,
                niveauAction: action === 'CREATE' ? 'CREATION' : 'EDITION',
                entityType: 'Lead',
                entityId: leadId,
                justification: details,
                previousState: metadata?.previousState,
                newState: metadata?.newState,
                // Champs optionnels non utilisés ici: phase, isForced, etc.
            }
        });
    } catch (e) {
        console.error('Failed to log lead action:', e);
        // Ne pas bloquer le flux principal si le log échoue
    }
}
