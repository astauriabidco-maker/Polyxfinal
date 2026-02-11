/**
 * COMPLIANCE GATES - Actions de signature documents partenaires
 * =============================================================
 */

export async function signPartnerDocument(partnerId: string, documentType: 'CONTRACT' | 'DPA') {
    const res = await fetch(`/api/partners/${partnerId}/documents/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la signature');
    }

    return res.json();
}
