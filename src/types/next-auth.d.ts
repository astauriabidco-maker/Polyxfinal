import { DefaultSession } from 'next-auth';
import { Role, MembershipScope, OrganizationType } from '@prisma/client';

declare global {
    interface MembershipInfo {
        organizationId: string;
        organizationName: string;
        organizationType: OrganizationType;
        role: Role;
        scope: MembershipScope;
        siteName: string | null;
        accessibleSites: { id: string; name: string }[];
    }
}

declare module 'next-auth' {
    /**
     * Extended user with multi-tenancy info
     */
    interface User {
        nom: string;
        prenom: string;
        currentMembershipId: string;
        role: Role;
        organizationId: string;
        organizationType: OrganizationType;
        organizationName: string;
        scope: MembershipScope;
        siteName: string | null;
        memberships: MembershipInfo[];
    }

    /**
     * Extended session to include the extended user
     */
    interface Session {
        user: {
            id: string;
            email: string;
            nom: string;
            prenom: string;
            currentMembershipId: string;
            role: Role;
            organizationId: string;
            organizationType: OrganizationType;
            organizationName: string;
            scope: MembershipScope;
            siteName: string | null;
            memberships: MembershipInfo[];
        } & DefaultSession['user'];
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        nom: string;
        prenom: string;
        currentMembershipId: string;
        role: Role;
        organizationId: string;
        organizationType: OrganizationType;
        organizationName: string;
        scope: MembershipScope;
        siteName: string | null;
        memberships: MembershipInfo[];
    }
}

export { };
