/**
 * MESSAGING INBOX PAGE — Server Component
 * =========================================
 * Layout split-view : liste des conversations + fil de discussion
 */

import InboxClient from '@/components/messaging/InboxClient';
import Sidebar from '@/components/layout/Sidebar';

export const metadata = {
    title: 'Messagerie | Polyx ERP',
    description: 'Inbox WhatsApp — Conversations avec les apprenants',
};

export default function MessagingPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex">
            <Sidebar />
            <main className="flex-1 ml-64">
                <InboxClient />
            </main>
        </div>
    );
}
