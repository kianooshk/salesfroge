import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECTS, serializeObject } from './object-meta';

@Injectable()
export class MetadataService {
  constructor(private prisma: PrismaService) {}

  async describe() {
    const [fields, customObjects] = await Promise.all([
      this.prisma.customField.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.customObject.findMany({ include: { fields: { orderBy: { order: 'asc' } } }, orderBy: { label: 'asc' } }),
    ]);
    const byObject = new Map<string, any[]>();
    for (const field of fields) {
      if (field.customObjectId) continue;
      const list = byObject.get(field.objectType) || [];
      list.push(field);
      byObject.set(field.objectType, list);
    }
    const objects = OBJECTS.map((config) => serializeObject(config, byObject.get(config.objectType) || []));
    for (const custom of customObjects) {
      objects.push({
        key: `custom-${custom.apiKey}`,
        objectType: `Custom:${custom.apiKey}`,
        label: custom.label,
        plural: custom.pluralLabel,
        icon: custom.icon || 'custom',
        endpoint: `/custom-objects/${custom.apiKey}/records`,
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'user', required: true },
          ...custom.fields.map((field) => ({
            name: field.apiName,
            label: field.label,
            type: field.type,
            required: field.required,
            options: (field.options as string[]) || undefined,
            custom: true,
          })),
        ],
        columns: [
          { name: 'name', label: 'Name' },
          ...custom.fields.slice(0, 4).map((field) => ({ name: field.apiName, label: field.label })),
          { name: 'owner', label: 'Owner' },
        ],
        highlights: ['owner', ...custom.fields.slice(0, 3).map((field) => field.apiName)],
        pathField: null,
        path: null,
        relatedLists: [],
        supportsKanban: false,
        supportsConvert: false,
        stages: undefined,
        custom: true,
        apiKey: custom.apiKey,
        customObjectId: custom.id,
      } as any);
    }
    return { objects };
  }
}

@Controller('metadata')
export class MetadataController {
  constructor(private metadata: MetadataService) {}

  @Get()
  describe() {
    return this.metadata.describe();
  }
}

@Module({ controllers: [MetadataController], providers: [MetadataService] })
export class MetadataModule {}
