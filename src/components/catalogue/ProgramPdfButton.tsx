'use client';

import { FileText } from 'lucide-react';

interface ProgramPdfButtonProps {
    programId: string;
}

export default function ProgramPdfButton({ programId }: ProgramPdfButtonProps) {
    return (
        <a
            href={`/catalogue/${programId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-slate-400 hover:text-blue-600 transition-colors z-20 relative block"
            title="Télécharger la fiche PDF"
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            <FileText className="w-4 h-4" />
        </a>
    );
}
