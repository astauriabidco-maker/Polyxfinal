
import { auth } from '@/auth';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProgramForm from '@/components/catalogue/ProgramForm';

export default async function EditProgramPage({ params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) redirect('/signin');

    const program: any = await prisma.programme.findUnique({
        where: { id: params.id },
        include: { organization: true }
    });

    if (!program) return notFound();
    if (program.organizationId !== session.user.organizationId && !program.isTemplate) return notFound(); // Allow edit if it's their program (or handle template logic)

    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">Modifier le Programme</h1>
            <ProgramForm initialData={program} />
        </div>
    );
}
