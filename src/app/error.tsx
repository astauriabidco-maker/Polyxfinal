
'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 text-center">
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                    Une erreur est survenue !
                </h2>
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200 overflow-auto text-left whitespace-pre-wrap font-mono">
                    {error.message}
                    {error.digest && <div className="mt-2 text-xs text-gray-500">Digest: {error.digest}</div>}
                </div>
                <button
                    onClick={() => reset()}
                    className="mt-8 w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Réessayer
                </button>
            </div>
        </div>
    );
}
