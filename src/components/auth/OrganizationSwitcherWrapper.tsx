'use client';

import dynamic from 'next/dynamic';

// Import dynamique du Switcher (client component)
const OrganizationSwitcher = dynamic(
    () => import('./OrganizationSwitcher'),
    {
        ssr: false,
        loading: () => (
            <div className="animate-pulse bg-slate-700/50 h-10 w-48 rounded-lg" />
        )
    }
);

export default function OrganizationSwitcherWrapper() {
    return <OrganizationSwitcher />;
}
