
'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
                    <h2>Une erreur critique est survenue</h2>
                    <pre style={{ background: '#fef2f2', color: '#991b1b', padding: '15px', borderRadius: '8px', overflow: 'auto' }}>
                        {error.message}
                    </pre>
                    <button
                        onClick={() => reset()}
                        style={{ marginTop: '20px', padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        Réessayer
                    </button>
                </div>
            </body>
        </html>
    );
}
