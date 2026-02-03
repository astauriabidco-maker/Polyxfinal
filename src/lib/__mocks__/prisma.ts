/**
 * Mock Prisma Client pour les tests
 * Utilise vitest-mock-extended pour mocker le PrismaClient
 */

import { PrismaClient } from '@prisma/client';
import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';

// Mock du module Prisma
vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => mockDeep<PrismaClient>()),
}));

// Instance mockée exportée
export const prismaMock = mockDeep<PrismaClient>();

// Reset avant chaque test
beforeEach(() => {
    mockReset(prismaMock);
});

export type MockPrismaClient = DeepMockProxy<PrismaClient>;
