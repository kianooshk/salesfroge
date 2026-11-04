import { LeadsService } from './leads.service';

const lead = {
  id: 'lead-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Analytical Engines',
  title: 'Founder',
  email: 'ada@engines.example',
  phone: '555-0100',
  website: 'https://engines.example',
  industry: 'Technology',
  source: 'Referral',
  street: '1 Bridge',
  city: 'London',
  state: null,
  postalCode: 'EC1',
  country: 'UK',
  description: 'Interested in a pilot',
  ownerId: 'user-1',
  isConverted: false,
};

describe('LeadsService.convert', () => {
  it('creates an account, contact and opportunity and marks the lead converted', async () => {
    const tx: any = {
      account: { create: jest.fn().mockResolvedValue({ id: 'account-1' }) },
      contact: { create: jest.fn().mockResolvedValue({ id: 'contact-1' }) },
      opportunity: { create: jest.fn().mockResolvedValue({ id: 'opp-1' }) },
      activity: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      lead: { update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...lead, ...data })) },
    };
    const prisma: any = {
      lead: { findUnique: jest.fn().mockResolvedValue(lead) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const result = await new LeadsService(prisma).convert({ id: 'user-1' } as any, 'lead-1', {
      createOpportunity: true,
      opportunityName: 'Analytical Engines pilot',
      amount: 25000,
    });
    expect(result.accountId).toBe('account-1');
    expect(result.contactId).toBe('contact-1');
    expect(result.opportunityId).toBe('opp-1');
    expect(tx.account.create.mock.calls[0][0].data.name).toBe('Analytical Engines');
    expect(tx.contact.create.mock.calls[0][0].data.accountId).toBe('account-1');
    expect(tx.lead.update.mock.calls[0][0].data.isConverted).toBe(true);
    expect(tx.activity.updateMany).toHaveBeenCalled();
  });

  it('refuses to convert a lead twice', async () => {
    const prisma: any = { lead: { findUnique: jest.fn().mockResolvedValue({ ...lead, isConverted: true }) } };
    await expect(new LeadsService(prisma).convert({} as any, 'lead-1', {})).rejects.toThrow('already converted');
  });
});
