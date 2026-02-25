const fs = require('fs');
let content = fs.readFileSync('prisma/seed.ts', 'utf8');

// The tricky part: some models use PhaseStatus.ACTIF (Programme, Dossier, etc.) 
// and some use SessionStatus.PLANIFIE or SessionStatus.EN_COURS (Session).

content = content.replace("import {\n    PrismaClient,\n    OrganizationType,\n    MembershipScope,\n    PhaseStatus,\n    TypeFinanceur,\n    NetworkType\n} from '@prisma/client';", "import {\n    PrismaClient,\n    OrganizationType,\n    MembershipScope,\n    PhaseStatus,\n    TypeFinanceur,\n    NetworkType,\n    SessionStatus\n} from '@prisma/client';");

// Only for sessions we want to update the status to PLANIFIE/ACTIF -> SessionStatus
// Actually, let's fix the schema so Session uses PhaseStatus everywhere instead 
// OR fix the seed to properly use SessionStatus for sessions.

const patterns = [
  /sessionCfaParis.*?status:\s+PhaseStatus\.ACTIF/s,
  /sessionCfaLyon.*?status:\s+PhaseStatus\.ACTIF/s,
  /sessionMarseille.*?status:\s+PhaseStatus\.ACTIF/s,
  /sessionNice.*?status:\s+PhaseStatus\.ACTIF/s,
  /sessionNewbie.*?status:\s+PhaseStatus\.ACTIF/s,
  /sessionSiege.*?status:\s+PhaseStatus\.ACTIF/s
];

let currentIndex = 0;
while (true) {
  let sessionCreatorIndex = content.indexOf('prisma.session.create(', currentIndex);
  if (sessionCreatorIndex === -1) break;
  
  let bracketCount = 0;
  let started = false;
  let endIndex = sessionCreatorIndex;
  
  for (let i = sessionCreatorIndex; i < content.length; i++) {
    if (content[i] === '{') {
      bracketCount++;
      started = true;
    } else if (content[i] === '}') {
      bracketCount--;
    }
    
    if (started && bracketCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  let block = content.substring(sessionCreatorIndex, endIndex + 1);
  let updatedBlock = block.replace('status: PhaseStatus.ACTIF', 'status: SessionStatus.EN_COURS').replace('status: PhaseStatus.PLANIFIE', 'status: SessionStatus.PLANIFIE');
  content = content.substring(0, sessionCreatorIndex) + updatedBlock + content.substring(endIndex + 1);
  currentIndex = sessionCreatorIndex + updatedBlock.length;
}

fs.writeFileSync('prisma/seed.ts', content);
