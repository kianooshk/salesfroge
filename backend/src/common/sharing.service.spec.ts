import { SharingService } from './sharing.service';

const roles = [
  { id: 'ceo', parentId: null },
  { id: 'vp', parentId: 'ceo' },
  { id: 'rep', parentId: 'vp' },
];

function prisma() {
  return {
    role: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(roles),
    },
    user: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => where.roleId.in.map((id: string) => ({ id: `user-${id}` }))),
      findUnique: jest.fn().mockResolvedValue({ roleId: 'rep' }),
    },
    teamMember: { findMany: jest.fn().mockResolvedValue([]) },
    share: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  };
}

const vp = { id: 'user-vp', email: 'vp@salesfroge.local', firstName: 'Jordan', lastName: 'Hale', isAdmin: false, roleId: 'vp' };
const rep = { id: 'sam', email: 'sam@salesfroge.local', firstName: 'Sam', lastName: 'Rivera', isAdmin: false, roleId: 'rep' };

describe('SharingService', () => {
  it('gives admins an unrestricted read scope', async () => {
    const scope = await new SharingService(prisma() as any).readScope({ ...vp, isAdmin: true }, 'Lead');
    expect(scope).toEqual({});
  });

  it('lets a manager edit a subordinate record', async () => {
    const allowed = await new SharingService(prisma() as any).canEditRecord(vp, 'Lead', 'lead-1', 'riley');
    expect(allowed).toBe(true);
  });

  it('does not let a peer edit another rep record without a share', async () => {
    const allowed = await new SharingService(prisma() as any).canEditRecord(rep, 'Lead', 'lead-1', 'riley');
    expect(allowed).toBe(false);
  });

  it('scopes a rep to their own records', async () => {
    const scope = await new SharingService(prisma() as any).readScope(rep, 'Lead');
    expect(scope.OR[0]).toEqual({ ownerId: { in: ['sam'] } });
  });

  it('honors an explicit edit share', async () => {
    const db = prisma();
    db.share.findFirst.mockResolvedValue({ id: 'share-1' });
    const allowed = await new SharingService(db as any).canEditRecord(rep, 'Opportunity', 'opp-1', 'riley');
    expect(allowed).toBe(true);
  });
});
