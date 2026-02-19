import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function ComplianceAudit({ program }: { program: any }) {
    const checks = [
        { label: "Objectifs Pédagogiques", valid: program.objectifs && program.objectifs.length > 0 },
        { label: "Public Cible", valid: !!program.publicCible },
        { label: "Prérequis", valid: !!program.prerequis },
        { label: "Durée (Heures/Jours)", valid: (program.dureeHeures && program.dureeHeures > 0) || (program.dureeJours && program.dureeJours > 0) },
        { label: "Tarifs (Inter/Intra)", valid: !!program.tarifInter || !!program.tarifIntra },
        { label: "Moyens Pédagogiques", valid: !!program.moyensPedago },
        { label: "Modalités d'évaluation", valid: !!program.modalitesEval },
        { label: "Accessibilité PSH", valid: !!program.accessibilitePSH },
    ];

    const validCount = checks.filter(c => c.valid).length;
    const score = Math.round((validCount / checks.length) * 100);
    const isCompliant = score === 100;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-right-4 duration-700">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    🛡️ Audit Qualiopi
                </h2>
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${isCompliant ? 'bg-green-50 text-green-700 border-green-200' :
                        score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {score}% Conforme
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
                <div
                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${isCompliant ? 'bg-green-500' :
                            score >= 50 ? 'bg-amber-500' :
                                'bg-red-500'
                        }`}
                    style={{ width: `${score}%` }}
                />
            </div>

            <ul className="space-y-3">
                {checks.map((check, i) => (
                    <li key={i} className="flex items-center justify-between text-sm group">
                        <span className={`flex items-center gap-2 transition-colors ${check.valid ? 'text-slate-600' : 'text-red-600 font-medium'}`}>
                            {check.valid ?
                                <CheckCircle className="w-4 h-4 text-green-500" /> :
                                <XCircle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                            }
                            {check.label}
                        </span>
                        {!check.valid && (
                            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 uppercase font-bold tracking-wider">
                                Manquant
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            {!isCompliant && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-800">Action Requise</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                            Ce programme ne respecte pas entièrement les indicateurs Qualiopi (Ind. 1 & 26).
                            Veuillez compléter les champs manquants avant diffusion publique.
                        </p>
                    </div>
                </div>
            )}

            {isCompliant && (
                <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full text-green-600">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-green-800">Programme Conforme</p>
                        <p className="text-xs text-green-700">Tous les indicateurs obligatoires sont présents.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
