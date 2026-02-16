/**
 * SIDEBAR NAVIGATION - Client Component
 * ======================================
 * Menu de navigation latéral organisé clairement.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

// Structure des menus
interface MenuItem {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
    description?: string;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

// Icônes réutilisables
const Icons = {
    grid: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
    ),
    chart: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    ),
    building: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    folder: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    mapPin: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    shield: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    ),
    check: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
    ),
    users: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    ),
    settings: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    plus: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
    ),
    list: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    ),
    store: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
    ),
    share: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
    ),
    coins: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    target: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
    ),
    phone: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
    ),
};

// Configuration claire des menus
const MENU_SECTIONS: MenuSection[] = [
    {
        title: 'Vue d\'ensemble',
        items: [
            {
                id: 'portfolio',
                label: 'Mes Organisations',
                href: '/portfolio',
                icon: Icons.grid,
                description: 'Gérer vos organisations',
            },
            {
                id: 'dashboard',
                label: 'Tableau de Bord',
                href: '/dashboard',
                icon: Icons.chart,
                description: 'Statistiques et KPIs',
            },
        ],
    },
    {
        title: 'Gestion Opérationnelle',
        items: [
            {
                id: 'dossiers',
                label: 'Dossiers Stagiaires',
                href: '/dashboard',
                icon: Icons.folder,
                description: 'Gérer les dossiers de formation',
            },
        ],
    },
    {
        title: 'Administration',
        items: [
            {
                id: 'org-list',
                label: 'Organisations',
                href: '/portfolio',
                icon: Icons.building,
                description: 'Gérer vos organisations',
            },
            {
                id: 'sites',
                label: 'Agences / Sites',
                href: '/sites',
                icon: Icons.mapPin,
                description: 'Gérer vos campus et lieux',
            },
            {
                id: 'users',
                label: 'Utilisateurs',
                href: '/users',
                icon: Icons.users,
                description: 'Gérer les accès utilisateurs',
            },
            {
                id: 'roles',
                label: 'Rôles & Permissions',
                href: '/settings/roles',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                ),
                description: 'Configurer les rôles et accès',
            },
            {
                id: 'settings',
                label: 'Paramètres',
                href: '#',
                icon: Icons.settings,
                badge: 'Bientôt',
                badgeColor: 'bg-slate-600',
                description: 'Configuration générale',
            },
        ],
    },
    {
        title: 'Conformité & Qualité',
        items: [
            {
                id: 'compliance',
                label: 'Moteur de Règles',
                href: '/demo/compliance',
                icon: Icons.shield,
                description: 'Vérification de conformité',
            },
            {
                id: 'qualiopi',
                label: 'Suivi Qualiopi',
                href: '/dashboard/qualiopi',
                icon: Icons.check,
                description: 'Tableau de bord Qualiopi',
            },
            {
                id: 'rgpd-register',
                label: 'Registre RGPD',
                href: '/prospection/rgpd',
                icon: Icons.shield,
                description: 'Registre Art. 30 des traitements',
            },
            {
                id: 'partner-qualification',
                label: 'Qualification Partenaires',
                href: '/prospection/partners/qualification',
                icon: Icons.check,
                description: 'Qualiopi Ind. 17 & 26',
            },
        ],
    },
    {
        title: 'Prospection',
        items: [
            {
                id: 'dispatcher',
                label: 'Dispatcher',
                href: '/prospection/dispatch',
                icon: Icons.share,
                description: 'Affectation des leads',
            },
            {
                id: 'my-leads',
                label: 'Mes Leads',
                href: '/prospection/leads',
                icon: Icons.phone,
                description: 'Traiter mes leads',
            },
            {
                id: 'leads',
                label: 'Pipeline Leads',
                href: '/prospection',
                icon: Icons.chart,
                description: 'Vue d\'ensemble',
            },
            {
                id: 'partners',
                label: 'Partenaires API',
                href: '/prospection/partners',
                icon: Icons.users,
                description: 'Prestataires externes',
            },
            {
                id: 'lead-quality',
                label: 'Qualité Leads',
                href: '/prospection/partners/quality',
                icon: Icons.chart,
                description: 'Scores et métriques qualité',
            },
            {
                id: 'network-config',
                label: 'Configuration Réseau',
                href: '/prospection/partners?tab=settings',
                icon: Icons.settings,
                description: 'Emails et Documentation',
            },
        ],
    },
    {
        title: 'Réseau Franchise',
        items: [
            {
                id: 'candidates',
                label: 'Candidats Franchise',
                href: '/network/candidates',
                icon: Icons.store,
                description: 'Gérer les candidats au réseau',
            },
            {
                id: 'territories',
                label: 'Territoires',
                href: '/network/territories',
                icon: Icons.target,
                description: 'Zones géographiques exclusives',
            },
            {
                id: 'royalties',
                label: 'Redevances',
                href: '/network/royalties',
                icon: Icons.coins,
                description: 'Calcul et suivi des redevances',
            },
            {
                id: 'franchise-config',
                label: 'Configuration',
                href: '/network/settings',
                icon: Icons.settings,
                description: 'Templates emails et documentation',
            },
        ],
    },
];

// Mapping: sidebar menu item id → permission code
const MENU_ITEM_PERMISSION_MAP: Record<string, string> = {
    'portfolio': 'module:portfolio',
    'dashboard': 'module:dashboard',
    'dossiers': 'module:dossiers',
    'org-list': 'module:organizations',
    'sites': 'module:sites',
    'users': 'module:users',
    'roles': 'module:roles',
    'settings': 'module:settings',
    'compliance': 'module:compliance',
    'qualiopi': 'module:qualiopi',
    'rgpd-register': 'module:rgpd',
    'partner-qualification': 'module:partner_qualification',
    'dispatcher': 'module:dispatcher',
    'my-leads': 'module:my_leads',
    'leads': 'module:leads',
    'partners': 'module:partners',
    'lead-quality': 'module:lead_quality',
    'network-config': 'module:network_config',
    'franchise-config': 'module:network_config',
    'candidates': 'module:candidates',
    'dispatch': 'module:candidates', // same category as candidates
    'territories': 'module:territories',
    'royalties': 'module:royalties',
};

interface SidebarProps {
    defaultCollapsed?: boolean;
    allowedModules?: string[]; // permission codes like ['module:dashboard', 'module:dossiers']
}

export default function Sidebar({ defaultCollapsed = false, allowedModules }: SidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    // Filter menu items based on permissions
    const isItemAllowed = (itemId: string): boolean => {
        // If no permission filter provided, show everything (backwards compatible)
        if (!allowedModules) return true;
        const permCode = MENU_ITEM_PERMISSION_MAP[itemId];
        // Items without a permission mapping are always visible
        if (!permCode) return true;
        return allowedModules.includes(permCode);
    };

    // Filter sections: only show sections that have at least one visible item
    const filteredSections = MENU_SECTIONS
        .map(section => ({
            ...section,
            items: section.items.filter(item => isItemAllowed(item.id)),
        }))
        .filter(section => section.items.length > 0);

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
                {filteredSections.map((section, sectionIdx) => (
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
                                                absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm
                                                rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible
                                                group-hover:opacity-100 group-hover:visible transition-all z-50
                                                border border-slate-700
                                            ">
                                                <p className="font-medium">{item.label}</p>
                                                {item.description && (
                                                    <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                                                )}
                                                {item.badge && (
                                                    <span className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded ${item.badgeColor || 'bg-blue-500'}`}>
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

            {/* Footer - Quick Help */}
            <div className={`p-4 border-t border-slate-700/50 ${isCollapsed ? 'text-center' : ''}`}>
                {!isCollapsed ? (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-400 font-medium mb-1">💡 Navigation rapide</p>
                        <p className="text-xs text-slate-500">
                            Accédez aux Sites depuis<br />
                            <span className="text-blue-400">Paramètres Organisation</span>
                        </p>
                    </div>
                ) : (
                    <div className="text-xs text-slate-500">v1.0</div>
                )}
            </div>
        </aside>
    );
}
