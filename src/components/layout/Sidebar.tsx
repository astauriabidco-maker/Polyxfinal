/**
 * SIDEBAR NAVIGATION - Client Component
 * ======================================
 * Menu de navigation latéral avec les modules implémentés.
 * Gère l'état collapsed/expanded et marque la page active.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// Structure des menus
interface MenuItem {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
    children?: MenuItem[];
}

// Configuration des menus par section
const MENU_SECTIONS = [
    {
        title: 'Principal',
        items: [
            {
                id: 'portfolio',
                label: 'Tour de Contrôle',
                href: '/portfolio',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                ),
            },
            {
                id: 'dashboard',
                label: 'Tableau de Bord',
                href: '/dashboard',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                ),
            },
        ],
    },
    {
        title: 'Gestion',
        items: [
            {
                id: 'dossiers',
                label: 'Dossiers',
                href: '/dashboard',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
            },
            {
                id: 'sites',
                label: 'Sites',
                href: '/demo/sites',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
                badge: 'CFA',
                badgeColor: 'bg-orange-500',
            },
        ],
    },
    {
        title: 'Conformité',
        items: [
            {
                id: 'compliance',
                label: 'Moteur de Règles',
                href: '/demo/compliance',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                ),
            },
            {
                id: 'qualiopi',
                label: 'Qualiopi',
                href: '#',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                ),
                badge: 'Bientôt',
                badgeColor: 'bg-slate-600',
            },
        ],
    },
    {
        title: 'Paramètres',
        items: [
            {
                id: 'organisation',
                label: 'Organisation',
                href: '/organizations/new',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
            },
            {
                id: 'users',
                label: 'Utilisateurs',
                href: '#',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ),
            },
        ],
    },
];

interface SidebarProps {
    defaultCollapsed?: boolean;
}

export default function Sidebar({ defaultCollapsed = false }: SidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const isActive = (href: string) => {
        if (href === '#') return false;
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <aside
            className={`
                fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700/50
                flex flex-col z-40 transition-all duration-300
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Logo / Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
                {!isCollapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">P</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-white">Polyx ERP</h1>
                            <p className="text-xs text-slate-400">Formation</p>
                        </div>
                    </div>
                )}

                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`
                        p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 
                        transition-colors ${isCollapsed ? 'mx-auto' : ''}
                    `}
                    title={isCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isCollapsed ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                {MENU_SECTIONS.map((section, sectionIdx) => (
                    <div key={section.title} className={sectionIdx > 0 ? 'mt-6' : ''}>
                        {/* Section Title */}
                        {!isCollapsed && (
                            <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {section.title}
                            </h3>
                        )}

                        {/* Menu Items */}
                        <ul className="space-y-1">
                            {section.items.map((item) => (
                                <li key={item.id}>
                                    <Link
                                        href={item.href}
                                        className={`
                                            flex items-center gap-3 px-3 py-2.5 rounded-lg
                                            transition-all duration-200 group relative
                                            ${isActive(item.href)
                                                ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                            }
                                            ${item.href === '#' ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                        onClick={(e) => item.href === '#' && e.preventDefault()}
                                    >
                                        {/* Icon */}
                                        <span className={`shrink-0 ${isActive(item.href) ? 'text-blue-400' : ''}`}>
                                            {item.icon}
                                        </span>

                                        {/* Label */}
                                        {!isCollapsed && (
                                            <span className="text-sm font-medium truncate">
                                                {item.label}
                                            </span>
                                        )}

                                        {/* Badge */}
                                        {!isCollapsed && item.badge && (
                                            <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${item.badgeColor || 'bg-blue-500'} text-white`}>
                                                {item.badge}
                                            </span>
                                        )}

                                        {/* Tooltip (collapsed mode) */}
                                        {isCollapsed && (
                                            <div className="
                                                absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm
                                                rounded shadow-lg whitespace-nowrap opacity-0 invisible
                                                group-hover:opacity-100 group-hover:visible transition-all z-50
                                            ">
                                                {item.label}
                                                {item.badge && (
                                                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${item.badgeColor || 'bg-blue-500'}`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className={`p-4 border-t border-slate-700/50 ${isCollapsed ? 'text-center' : ''}`}>
                {!isCollapsed ? (
                    <div className="text-xs text-slate-500">
                        <p>Polyx ERP Formation</p>
                        <p className="mt-1">Version 1.0.0</p>
                    </div>
                ) : (
                    <div className="text-xs text-slate-500">v1.0</div>
                )}
            </div>
        </aside>
    );
}
