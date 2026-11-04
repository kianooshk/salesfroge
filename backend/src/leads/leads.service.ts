import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser } from '../common/decorators';

const OBJECT = 'Lead';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  async findAll(user: AuthUser, query: { search?: string; status?: string; ownerId?: string }) {
    const scope = await this.sharing.readScope(user, OBJECT);
    const where: any = { AND: [scope, { isConverted: false }] };
    if (query.status) where.AND.push({ status: query.status });
    if (query.ownerId) where.AND.push({ ownerId: query.ownerId });
    if (query.search) {
      where.AND.push({
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { company: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.lead.findMany({
      where,
      include: { owner: { select: { id: true, firstName: true, lastName: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { owner: { select: { id: true, firstName: true, lastName: true, avatarColor: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(user: AuthUser, data: any) {
    return this.prisma.lead.create({
      data: { ...data, ownerId: data.ownerId || user.id },
    });
  }

  async update(user: AuthUser, id: string, data: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const canEdit = await this.sharing.canEditRecord(user, OBJECT, id, lead.ownerId);
    if (!canEdit) throw new ForbiddenException('You cannot edit this lead');
    return this.prisma.lead.update({ where: { id }, data });
  }

  async remove(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    const canEdit = await this.sharing.canEditRecord(user, OBJECT, id, lead.ownerId);
    if (!canEdit) throw new ForbiddenException('You cannot delete this lead');
    await this.prisma.lead.delete({ where: { id } });
    return { success: true };
  }

  /** Convert a lead into Account + Contact (+ optional Opportunity). */
  async convert(
    user: AuthUser,
    id: string,
    options: { createOpportunity?: boolean; opportunityName?: string; amount?: number; closeDate?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.isConverted) throw new ForbiddenException('Lead is already converted');

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: lead.company,
          industry: lead.industry,
          website: lead.website,
          phone: lead.phone,
          billingStreet: lead.street,
          billingCity: lead.city,
          billingState: lead.state,
          billingPostal: lead.postalCode,
          billingCountry: lead.country,
          ownerId: lead.ownerId,
        },
      });

      const contact = await tx.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          title: lead.title,
          email: lead.email,
          phone: lead.phone,
          accountId: account.id,
          ownerId: lead.ownerId,
        },
      });

      let opportunity = null as null | { id: string };
      if (options.createOpportunity) {
        opportunity = await tx.opportunity.create({
          data: {
            name: options.opportunityName || `${lead.company} Opportunity`,
            accountId: account.id,
            contactId: contact.id,
            stage: 'Qualification',
            amount: options.amount ?? null,
            closeDate: options.closeDate ? new Date(options.closeDate) : null,
            leadSource: lead.source,
            ownerId: lead.ownerId,
          },
        });
      }

      // Re-point the lead's activities/feed to the new contact.
      await tx.activity.updateMany({
        where: { relatedType: 'Lead', relatedId: lead.id },
        data: { relatedType: 'Contact', relatedId: contact.id },
      });

      const updated = await tx.lead.update({
        where: { id },
        data: {
          isConverted: true,
          convertedAt: new Date(),
          status: 'Qualified',
          convertedAccountId: account.id,
          convertedContactId: contact.id,
          convertedOpportunityId: opportunity?.id ?? null,
        },
      });

      return {
        lead: updated,
        accountId: account.id,
        contactId: contact.id,
        opportunityId: opportunity?.id ?? null,
      };
    });
  }
}
