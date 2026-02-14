/**
 * SIDEBAR WRAPPER - Server Component
 * ====================================
 * Loads the user's role permissions and passes them to the client Sidebar.
 * Falls back to showing all modules if permissions can't be loaded.
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Sidebar from './Sidebar';

export default async function SidebarWithPermissions() {
    let allowedModules: string[] | undefined;

    try {
        const session = await auth();

        if (session?.user) {
            const roleObj = session.user.role;
            const roleCode = typeof roleObj === 'string' ? roleObj : (roleObj as any)?.code;

            // ADMIN gets all permissions — don't filter
            if (roleCode === 'ADMIN') {
                return <Sidebar />;
            }

            // Get the user's role ID from their membership
            if (session.user.organizationId && session.user.id) {
                const membership = await prisma.membership.findFirst({
                    where: {
                        userId: session.user.id,
                        organizationId: session.user.organizationId,
                    },
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                });

                if (membership?.role?.permissions) {
                    allowedModules = membership.role.permissions.map(
                        (rp: any) => rp.permission.code
                    );
                }
            }
        }
    } catch (error) {
        console.error('[SidebarWrapper] Error loading permissions:', error);
        // Fallback: show all modules
    }

    return <Sidebar allowedModules={allowedModules} />;
}
