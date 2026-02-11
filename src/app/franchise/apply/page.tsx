import PublicApplicationForm from './PublicApplicationForm';

export const metadata = {
    title: 'Devenir Franchisé | Polyx ERP',
    description: 'Rejoignez le réseau Polyx et lancez votre propre centre de formation.',
};

export default function FranchiseApplyPage() {
    return (
        <main className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Opportunité Réseau 2026
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                        Propulsez votre <br />
                        <span className="text-blue-500">Organisme de Formation</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Rejoignez un réseau innovant, digitalisé et structuré pour la réussite.
                        Remplissez ce formulaire pour initier votre dossier de candidature.
                    </p>
                </div>

                <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <PublicApplicationForm />
                </div>

                <footer className="mt-20 text-center text-slate-500 text-sm">
                    &copy; 2026 Polyx ERP Formation • Tous droits réservés. <br />
                    L'envoi de ce formulaire ne constitue pas un engagement contractuel.
                </footer>
            </div>
        </main>
    );
}
