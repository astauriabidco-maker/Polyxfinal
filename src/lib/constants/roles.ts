export const ROLE_IDS = {
    ADMIN: 'role_admin',
    RESP_PEDAGO: 'role_resp_pedago',
    RESP_ADMIN: 'role_resp_admin',
    REF_QUALITE: 'role_ref_qualite',
    FORMAT: 'role_format',
} as const;

export const ROLE_CODES = {
    ADMIN: 'ADMIN',
    RESP_PEDAGO: 'RESP_PEDAGO',
    RESP_ADMIN: 'RESP_ADMIN',
    REF_QUALITE: 'REF_QUALITE',
    FORMAT: 'FORMAT',
} as const;

export type SystemRoleCode = keyof typeof ROLE_CODES;
