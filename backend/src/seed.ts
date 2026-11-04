import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OBJECTS = ['Lead', 'Account', 'Contact', 'Opportunity', 'Case', 'Activity', 'CustomRecord'];

function permissions(viewAll: boolean, modifyAll: boolean, overrides: Record<string, any> = {}) {
  const result: Record<string, any> = {};
  for (const name of OBJECTS) {
    result[name] = {
      read: true,
      create: true,
      edit: true,
      delete: true,
      viewAll,
      modifyAll,
      ...(overrides[name] || {}),
    };
  }
  return result;
}

function daysFromNow(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function seed(prisma: PrismaClient) {
  const existing = await prisma.user.findUnique({ where: { email: 'avery@salesfroge.local' } });
  if (existing) {
    console.log('Seed data already present, skipping.');
    return;
  }

  const password = await bcrypt.hash('salesfroge', 10);

  const ceo = await prisma.role.create({
    data: {
      name: 'Chief Executive',
      description: 'Sees and edits every record.',
      permissions: permissions(true, true),
    },
  });
  const vp = await prisma.role.create({
    data: {
      name: 'VP of Sales',
      description: 'Sees the full sales pipeline. Sits above sales reps in the hierarchy.',
      parentId: ceo.id,
      permissions: permissions(false, false, {
        Lead: { viewAll: true },
        Account: { viewAll: true },
        Contact: { viewAll: true },
        Opportunity: { viewAll: true },
        Activity: { viewAll: true },
      }),
    },
  });
  const rep = await prisma.role.create({
    data: {
      name: 'Sales Representative',
      description: 'Works their own leads, accounts and opportunities. Managers above them can see their records.',
      parentId: vp.id,
      permissions: permissions(false, false),
    },
  });
  const support = await prisma.role.create({
    data: {
      name: 'Support Agent',
      description: 'Works every case. Sales records stay with the sales hierarchy.',
      parentId: ceo.id,
      permissions: permissions(false, false, {
        Case: { viewAll: true, modifyAll: true },
      }),
    },
  });

  const [avery, jordan, sam, riley, morgan] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'avery@salesfroge.local',
        password,
        firstName: 'Avery',
        lastName: 'Chen',
        title: 'Chief Executive',
        phone: '415-555-0100',
        avatarColor: '#1b5f8c',
        isAdmin: true,
        roleId: ceo.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'jordan@salesfroge.local',
        password,
        firstName: 'Jordan',
        lastName: 'Hale',
        title: 'VP of Sales',
        phone: '415-555-0101',
        avatarColor: '#0b827c',
        roleId: vp.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'sam@salesfroge.local',
        password,
        firstName: 'Sam',
        lastName: 'Rivera',
        title: 'Account Executive',
        phone: '415-555-0102',
        avatarColor: '#9050e9',
        roleId: rep.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'riley@salesfroge.local',
        password,
        firstName: 'Riley',
        lastName: 'Quinn',
        title: 'Account Executive',
        phone: '415-555-0103',
        avatarColor: '#e07c00',
        roleId: rep.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'morgan@salesfroge.local',
        password,
        firstName: 'Morgan',
        lastName: 'Blake',
        title: 'Support Lead',
        phone: '415-555-0104',
        avatarColor: '#b60554',
        roleId: support.id,
      },
    }),
  ]);

  const [west, east] = await Promise.all([
    prisma.team.create({
      data: {
        name: 'West Sales',
        description: 'Pacific accounts',
        members: { create: [{ userId: jordan.id, role: 'lead' }, { userId: sam.id, role: 'member' }] },
      },
    }),
    prisma.team.create({
      data: {
        name: 'East Sales',
        description: 'Atlantic accounts',
        members: { create: [{ userId: jordan.id, role: 'lead' }, { userId: riley.id, role: 'member' }] },
      },
    }),
  ]);
  await prisma.team.create({
    data: {
      name: 'Customer Support',
      description: 'Case queue',
      members: { create: [{ userId: morgan.id, role: 'lead' }] },
    },
  });

  const accounts = await Promise.all(
    [
      ['Harbor & Co', 'Customer', 'Finance', 'https://harbor.example', '212-555-0140', 420, 48000000, jordan.id, 'New York', 'NY'],
      ['Lumen Labs', 'Prospect', 'Technology', 'https://lumenlabs.example', '628-555-0172', 85, 9200000, sam.id, 'San Francisco', 'CA'],
      ['Brightpath Health', 'Customer', 'Healthcare', 'https://brightpath.example', '617-555-0194', 1200, 120000000, sam.id, 'Boston', 'MA'],
      ['Copperline Retail', 'Prospect', 'Retail', 'https://copperline.example', '312-555-0166', 640, 35000000, riley.id, 'Chicago', 'IL'],
      ['Northstar Manufacturing', 'Customer', 'Manufacturing', 'https://northstar.example', '313-555-0118', 2100, 250000000, riley.id, 'Detroit', 'MI'],
      ['Kindred Education', 'Partner', 'Education', 'https://kindred.example', '206-555-0133', 90, 4000000, jordan.id, 'Seattle', 'WA'],
    ].map(([name, type, industry, website, phone, employees, revenue, ownerId, city, state]) =>
      prisma.account.create({
        data: {
          name: name as string,
          type: type as string,
          industry: industry as string,
          website: website as string,
          phone: phone as string,
          employees: employees as number,
          annualRevenue: revenue as number,
          ownerId: ownerId as string,
          billingCity: city as string,
          billingState: state as string,
          billingCountry: 'USA',
        },
      }),
    ),
  );
  const [harbor, lumen, brightpath, copperline, northstar, kindred] = accounts;

  const contacts = await Promise.all(
    [
      ['Maya', 'Ellison', 'VP Operations', 'maya.ellison@harbor.example', harbor.id, jordan.id],
      ['Chris', 'Dalton', 'Controller', 'chris.dalton@harbor.example', harbor.id, jordan.id],
      ['Priya', 'Shah', 'CTO', 'priya.shah@lumenlabs.example', lumen.id, sam.id],
      ['Elena', 'Voss', 'Head of IT', 'elena.voss@brightpath.example', brightpath.id, sam.id],
      ['Owen', 'Park', 'COO', 'owen.park@copperline.example', copperline.id, riley.id],
      ['Dana', 'Brooks', 'Plant Director', 'dana.brooks@northstar.example', northstar.id, riley.id],
      ['Noah', 'Ivers', 'Partnerships', 'noah.ivers@kindred.example', kindred.id, jordan.id],
    ].map(([firstName, lastName, title, email, accountId, ownerId]) =>
      prisma.contact.create({
        data: { firstName, lastName, title, email, accountId, ownerId, mailingCountry: 'USA' },
      }),
    ),
  );
  const [maya, , priya, elena, owen, dana] = contacts;

  await Promise.all(
    [
      ['Noah', 'Bennett', 'Piper & Oak', 'Working', 'Warm', 'Web', 'Retail', riley.id, 'noah@piper.example'],
      ['Alicia', 'Nguyen', 'Fieldnote', 'New', 'Hot', 'Referral', 'Technology', sam.id, 'alicia@fieldnote.example'],
      ['Hugo', 'Martens', 'Glassline', 'Nurturing', 'Warm', 'Trade Show', 'Manufacturing', sam.id, 'hugo@glassline.example'],
      ['Sofia', 'Reyes', 'Cinder Health', 'Qualified', 'Hot', 'Partner', 'Healthcare', jordan.id, 'sofia@cinder.example'],
      ['Jonah', 'Adler', 'Maple & Rye', 'New', 'Cold', 'Phone', 'Retail', riley.id, 'jonah@maple.example'],
      ['Leah', 'Okoye', 'Paperkite', 'Working', 'Hot', 'Web', 'Media', sam.id, 'leah@paperkite.example'],
      ['Evan', 'Cho', 'Southbend Credit', 'Unqualified', 'Cold', 'Web', 'Finance', jordan.id, 'evan@southbend.example'],
    ].map(([firstName, lastName, company, status, rating, source, industry, ownerId, email]) =>
      prisma.lead.create({
        data: { firstName, lastName, company, status, rating, source, industry, ownerId, email, country: 'USA' },
      }),
    ),
  );

  const piperLead = await prisma.lead.findFirst({ where: { company: 'Piper & Oak' } });
  if (piperLead) {
    await prisma.share.create({
      data: { recordType: 'Lead', recordId: piperLead.id, teamId: west.id, access: 'read' },
    });
  }

  const opportunities = await Promise.all(
    [
      ['Harbor treasury rollout', harbor.id, maya.id, 'Negotiation', 180000, 14, jordan.id, 'Existing Business'],
      ['Lumen Labs platform', lumen.id, priya.id, 'Proposal', 96000, 21, sam.id, 'New Business'],
      ['Brightpath patient portal', brightpath.id, elena.id, 'Needs Analysis', 240000, 40, sam.id, 'New Business'],
      ['Copperline loyalty', copperline.id, owen.id, 'Qualification', 54000, 30, riley.id, 'New Business'],
      ['Northstar line upgrade', northstar.id, dana.id, 'Prospecting', 310000, 60, riley.id, 'Existing Business'],
      ['Kindred partner seats', kindred.id, contacts[6].id, 'Closed Won', 28000, -5, jordan.id, 'Existing Business'],
      ['Harbor analytics add-on', harbor.id, maya.id, 'Closed Lost', 45000, -12, jordan.id, 'New Business'],
      ['Lumen Labs expansion', lumen.id, priya.id, 'Negotiation', 72000, 9, sam.id, 'Existing Business'],
    ].map(([name, accountId, contactId, stage, amount, closeIn, ownerId, type]) =>
      prisma.opportunity.create({
        data: {
          name: name as string,
          accountId: accountId as string,
          contactId: contactId as string,
          stage: stage as string,
          amount: amount as number,
          closeDate: daysFromNow(closeIn as number),
          probability:
            { Prospecting: 10, Qualification: 20, 'Needs Analysis': 35, Proposal: 60, Negotiation: 80, 'Closed Won': 100, 'Closed Lost': 0 }[
              stage as string
            ],
          type: type as string,
          leadSource: 'Partner',
          nextStep: 'Confirm stakeholders and send the revised scope.',
          ownerId: ownerId as string,
        },
      }),
    ),
  );

  await prisma.share.create({
    data: { recordType: 'Opportunity', recordId: opportunities[1].id, userId: riley.id, access: 'edit' },
  });

  await Promise.all(
    [
      ['Cannot export the quarterly statement', 'High', 'Working', 'Problem', 'Email', harbor.id, maya.id, morgan.id, 1],
      ['Portal login loop on mobile', 'High', 'New', 'Problem', 'Web', brightpath.id, elena.id, morgan.id, 0],
      ['Add a second billing contact', 'Low', 'Working', 'Question', 'Phone', kindred.id, contacts[6].id, morgan.id, 5],
      ['Shipment status API timeout', 'Medium', 'Escalated', 'Problem', 'Email', copperline.id, owen.id, morgan.id, -1],
      ['Request SSO for the plant team', 'Medium', 'New', 'Feature Request', 'Phone', northstar.id, dana.id, morgan.id, 3],
      ['Closed: reset admin password', 'Low', 'Closed', 'Question', 'Phone', harbor.id, contacts[1].id, morgan.id, -2],
    ].map(([subject, priority, status, type, origin, accountId, contactId, ownerId, sla]) =>
      prisma.case.create({
        data: {
          subject: subject as string,
          priority: priority as string,
          status: status as string,
          type: type as string,
          origin: origin as string,
          accountId: accountId as string,
          contactId: contactId as string,
          ownerId: ownerId as string,
          slaDueAt: daysFromNow(sla as number, 17),
          closedAt: status === 'Closed' ? daysFromNow(-1) : null,
          description: 'Logged from the demo seed so the support queue, priorities and SLA dates are visible immediately.',
        },
      }),
    ),
  );

  await Promise.all([
    prisma.activity.create({
      data: {
        type: 'Task',
        subject: 'Send Harbor the revised rollout plan',
        status: 'Open',
        priority: 'High',
        dueDate: daysFromNow(1),
        relatedType: 'Opportunity',
        relatedId: opportunities[0].id,
        ownerId: jordan.id,
        createdById: jordan.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'Call',
        subject: 'Discovery call with Priya Shah',
        status: 'Completed',
        description: 'Priya wants a pilot in the data team before a company-wide rollout.',
        startTime: daysFromNow(-2, 15),
        relatedType: 'Contact',
        relatedId: priya.id,
        ownerId: sam.id,
        createdById: sam.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'Meeting',
        subject: 'Lumen Labs proposal review',
        status: 'Open',
        location: 'Video call',
        startTime: daysFromNow(2, 11),
        endTime: daysFromNow(2, 12),
        relatedType: 'Opportunity',
        relatedId: opportunities[1].id,
        ownerId: sam.id,
        createdById: sam.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'Meeting',
        subject: 'Northstar plant walkthrough',
        status: 'Open',
        location: 'Detroit',
        startTime: daysFromNow(6, 9),
        endTime: daysFromNow(6, 12),
        relatedType: 'Account',
        relatedId: northstar.id,
        ownerId: riley.id,
        createdById: riley.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'Note',
        subject: 'Brightpath security review notes',
        description: 'Security asked for a SOC report and a list of subprocessors. Follow up after the proposal.',
        relatedType: 'Account',
        relatedId: brightpath.id,
        ownerId: sam.id,
        createdById: sam.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: 'Task',
        subject: 'Chase the Copperline SLA breach',
        status: 'Open',
        priority: 'High',
        dueDate: daysFromNow(0),
        relatedType: 'Account',
        relatedId: copperline.id,
        ownerId: morgan.id,
        createdById: morgan.id,
      },
    }),
  ]);

  const post = await prisma.feedItem.create({
    data: {
      authorId: jordan.id,
      relatedType: 'Account',
      relatedId: harbor.id,
      body: `Harbor wants the treasury rollout live before quarter end. @[Sam Rivera](${sam.id}) can you join the negotiation call?`,
    },
  });
  await prisma.feedComment.create({
    data: { feedItemId: post.id, authorId: sam.id, body: 'I can make Thursday. I will bring the revised scope.' },
  });
  await prisma.feedItem.create({
    data: {
      authorId: avery.id,
      body: 'Welcome to Salesfroge. This company feed is where wins, blockers and handoffs belong.',
    },
  });
  await prisma.notification.create({
    data: {
      userId: sam.id,
      type: 'mention',
      message: 'Jordan Hale mentioned you on Harbor & Co',
      link: `/o/accounts/${harbor.id}`,
    },
  });

  const intro = await prisma.emailTemplate.create({
    data: {
      name: 'Introduction',
      subject: 'Hello from Salesfroge, {{name}}',
      body: 'Hi {{name}},\n\nThanks for taking the time to talk. I will send a short plan for {{accountName}} shortly.\n\nBest,\n{{ownerName}}',
      createdById: jordan.id,
    },
  });
  await prisma.emailTemplate.create({
    data: {
      name: 'Follow up',
      subject: 'Following up on {{name}}',
      body: 'Hi {{name}},\n\nChecking in on the next step we discussed. Happy to adjust timing if this week is tight.\n\nThanks,\n{{ownerName}}',
      createdById: sam.id,
    },
  });
  await prisma.emailMessage.create({
    data: {
      direction: 'outbound',
      fromAddress: 'sam@salesfroge.local',
      toAddresses: 'priya.shah@lumenlabs.example',
      subject: 'Lumen Labs proposal',
      body: 'Priya, attaching the pilot outline we discussed. The data-team rollout is scoped for three weeks.',
      status: 'logged',
      relatedType: 'Contact',
      relatedId: priya.id,
      userId: sam.id,
      templateId: intro.id,
      sentAt: daysFromNow(-1, 16),
    },
  });

  const projects = await prisma.customObject.create({
    data: {
      label: 'Project',
      pluralLabel: 'Projects',
      apiKey: 'project',
      description: 'Delivery projects tracked without writing code.',
      fields: {
        create: [
          { objectType: 'Custom:project', label: 'Status', apiName: 'status', type: 'picklist', options: ['Planned', 'Active', 'On Hold', 'Done'], order: 1 },
          { objectType: 'Custom:project', label: 'Budget', apiName: 'budget', type: 'currency', order: 2 },
        ],
      },
    },
  });
  await prisma.customRecord.create({
    data: { customObjectId: projects.id, name: 'Harbor treasury delivery', ownerId: jordan.id, values: { status: 'Active', budget: 180000 } },
  });
  await prisma.customRecord.create({
    data: { customObjectId: projects.id, name: 'Brightpath security packet', ownerId: sam.id, values: { status: 'Planned', budget: 15000 } },
  });
  await prisma.customField.create({
    data: { objectType: 'Account', label: 'Customer since', apiName: 'customerSince', type: 'date', order: 1 },
  });

  const [pipeline, leadStatus, leadSource, casePriority] = await Promise.all([
    prisma.report.create({
      data: { name: 'Pipeline by stage', objectType: 'Opportunity', groupBy: 'stage', aggregate: 'sum', aggregateField: 'amount', chartType: 'funnel', ownerId: jordan.id, description: 'Open and closed amount by stage.' },
    }),
    prisma.report.create({
      data: { name: 'Leads by status', objectType: 'Lead', groupBy: 'status', aggregate: 'count', chartType: 'bar', ownerId: jordan.id },
    }),
    prisma.report.create({
      data: { name: 'Leads by source', objectType: 'Lead', groupBy: 'source', aggregate: 'count', chartType: 'pie', ownerId: sam.id },
    }),
    prisma.report.create({
      data: { name: 'Cases by priority', objectType: 'Case', groupBy: 'priority', aggregate: 'count', chartType: 'bar', filters: [{ field: 'status', op: 'neq', value: 'Closed' }], ownerId: morgan.id },
    }),
  ]);
  await prisma.dashboard.create({
    data: {
      name: 'Sales overview',
      ownerId: jordan.id,
      widgets: [{ reportId: pipeline.id }, { reportId: leadStatus.id }, { reportId: leadSource.id }, { reportId: casePriority.id }],
    },
  });

  await prisma.listView.create({
    data: {
      name: 'Hot leads',
      objectType: 'Lead',
      filters: [{ field: 'rating', op: 'eq', value: 'Hot' }],
      isShared: true,
      ownerId: jordan.id,
    },
  });
  await prisma.listView.create({
    data: {
      name: 'My open tasks',
      objectType: 'Activity',
      filters: [
        { field: 'type', op: 'eq', value: 'Task' },
        { field: 'status', op: 'eq', value: 'Open' },
      ],
      isShared: true,
      ownerId: avery.id,
    },
  });

  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const filename = 'seed-lumen-outline.txt';
  writeFileSync(
    join(uploadDir, filename),
    'Lumen Labs pilot\n\nWeek 1: connect the warehouse.\nWeek 2: train the data team.\nWeek 3: review adoption.\n',
  );
  await prisma.fileAsset.create({
    data: {
      filename,
      originalName: 'Lumen pilot outline.txt',
      mimeType: 'text/plain',
      size: 120,
      relatedType: 'Opportunity',
      relatedId: opportunities[1].id,
      uploadedById: sam.id,
    },
  });

  console.log('Seeded Salesfroge. Sign in as avery@salesfroge.local / salesfroge');
  console.log(`Teams ready: ${west.name}, ${east.name}`);
}
