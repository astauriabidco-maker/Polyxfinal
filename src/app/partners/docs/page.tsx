/**
 * PUBLIC PARTNER API DOCUMENTATION
 * =================================
 * Page de documentation technique pour les apporteurs d'affaires.
 */

'use client';

import { useState, useEffect } from 'react';

export default function PartnerDocsPage() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/network/settings')
            .then(res => res.json())
            .then(data => {
                setContent(data.apiDocumentationMarkdown);
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-purple-500/30">
            <div className="max-w-5xl mx-auto py-16 px-6">
                {content ? (
                    <div className="prose prose-invert max-w-none 
                        prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                        prose-a:text-purple-400 hover:prose-a:text-purple-300
                        prose-code:text-cyan-400 prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl shadow-2xl">
                        <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
                    </div>
                ) : (
                    <div className="text-center py-24">
                        <div className="text-6xl mb-6">📝</div>
                        <h1 className="text-3xl font-bold text-white mb-4">Documentation en cours</h1>
                        <p className="text-slate-500 max-w-md mx-auto">
                            L&apos;équipe technique est en train de mettre à jour la documentation.
                            Revenez dans quelques instants ou contactez votre référent Polyx ERP.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

