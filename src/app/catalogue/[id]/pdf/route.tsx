
import { renderToStream } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { ProgramPdf } from '@/components/catalogue/ProgramPdf';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    // Security check: user must be authenticated
    const session = await auth();
    if (!session?.user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const program = await prisma.programme.findUnique({
            where: { id: params.id },
            include: {
                organization: true, // Fetch organization details for the PDF
            },
        });

        if (!program) {
            return new NextResponse('Program not found', { status: 404 });
        }

        // Generate PDF stream
        const stream = await renderToStream(<ProgramPdf program={program} />);

        // Create filename
        const safeTitle = program.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `programme_${safeTitle}.pdf`;

        // Return stream response
        return new NextResponse(stream as unknown as ReadableStream, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('PDF Generation Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
