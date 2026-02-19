'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { saveAISettings } from '@/app/actions/settings';
import { Cpu, Save, Key, RefreshCw } from 'lucide-react';

export default function AISettingsForm({ initialData }: { initialData?: any }) {
    const [provider, setProvider] = useState(initialData?.provider || 'openai');
    const [model, setModel] = useState(initialData?.model || '');
    const [apiKey, setApiKey] = useState(initialData?.apiKey || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveAISettings({ provider, model, apiKey });
            toast.success("Configuration IA sauvegardée !");
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                    <Cpu className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Moteur d'Intelligence Artificielle</h2>
                    <p className="text-sm text-slate-500">Choisissez votre modèle génératif préféré.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Fournisseur</label>
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="openai">OpenAI (GPT-4)</option>
                        <option value="anthropic">Anthropic (Claude 3)</option>
                        <option value="mistral">Mistral AI (Europe)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Modèle (Optionnel)</label>
                    <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={
                            provider === 'openai' ? 'gpt-4o' :
                                provider === 'anthropic' ? 'claude-3-opus-20240229' :
                                    'mistral-large-latest'
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    />
                    <p className="text-xs text-slate-400">Laisser vide pour utiliser le modèle par défaut recommandé.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Clé API (Secrète)</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm transition-all"
                        />
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                        <p>Votre clé est cryptée et liée à votre organisation.</p>
                        <p className="italic text-slate-400">Si laissé vide, l'application utilisera la clé définie dans les variables d'environnement (si existante).</p>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl"
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer la configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
