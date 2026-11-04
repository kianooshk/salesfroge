import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  /** Convert a lead into an Account, a Contact, and optionally an Opportunity. */
  async convert(
    user: AuthUser,
    id: string,
    options: { createOpportunity?: boolean; opportunityName?: string; amount?: number; closeDate?: string } = {},
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
          description: lead.description,
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
          mailingStreet: lead.street,
          mailingCity: lead.city,
          mailingState: lead.state,
          mailingPostal: lead.postalCode,
          mailingCountry: lead.country,
          accountId: account.id,
          ownerId: lead.ownerId,
        },
      });

      let opportunityId: string | null = null;
      if (options.createOpportunity !== false) {
        const opportunity = await tx.opportunity.create({
          data: {
            name: options.opportunityName || `${lead.company} - ${lead.firstName} ${lead.lastName}`,
            accountId: account.id,
            contactId: contact.id,
            stage: 'Qualification',
            probability: 20,
            amount: options.amount != null && options.amount !== ('' as any) ? Number(options.amount) : null,
            closeDate: options.closeDate ? new Date(options.closeDate) : null,
            leadSource: lead.source,
            ownerId: lead.ownerId,
          },
        });
        opportunityId = opportunity.id;
      }

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
          convertedOpportunityId: opportunityId,
        },
      });

      return {
        lead: updated,
        accountId: account.id,
        contactId: contact.id,
        opportunityId,
      };
    });
  }
}
