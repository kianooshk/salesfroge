import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join, basename, resolve } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { OBJECT_BY_API } from '../metadata/object-meta';
import { andWhere } from '../common/data';

function uploadDir() {
  const dir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  list(relatedType?: string, relatedId?: string) {
    return this.prisma.fileAsset.findMany({
      where: { relatedType: relatedType || undefined, relatedId: relatedId || undefined },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async save(user: AuthUser, file: Express.Multer.File, relatedType?: string, relatedId?: string) {
    if (!file) throw new NotFoundException('No file uploaded');
    return this.prisma.fileAsset.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
        uploadedById: user.id,
      },
    });
  }

  async assertCanRead(user: AuthUser, file: { uploadedById: string; relatedType: string | null; relatedId: string | null }) {
    if (user.isAdmin || file.uploadedById === user.id) return;
    if (file.relatedType && file.relatedId) {
      const config = OBJECT_BY_API[file.relatedType];
      if (!config) return;
      const scope = await this.sharing.readScope(user, config.objectType);
      const visible = await (this.prisma as any)[config.model].findFirst({
        where: andWhere({ id: file.relatedId }, scope),
      });
      if (!visible) throw new ForbiddenException('You cannot access this file');
      return;
    }
    throw new ForbiddenException('You cannot access this file');
  }

  async get(user: AuthUser, id: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    await this.assertCanRead(user, file);
    return file;
  }

  async remove(user: AuthUser, id: string) {
    const file = await this.get(user, id);
    if (file.uploadedById !== user.id && !user.isAdmin) throw new ForbiddenException();
    await this.prisma.fileAsset.delete({ where: { id } });
    return { success: true };
  }

  pathFor(file: { filename: string }) {
    return resolve(uploadDir(), basename(file.filename));
  }
}

@Controller('files')
export class FilesController {
  constructor(private files: FilesService) {}

  @Get()
  list(@Query('relatedType') relatedType?: string, @Query('relatedId') relatedId?: string) {
    return this.files.list(relatedType, relatedId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir()),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').slice(0, 12);
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('relatedType') relatedType?: string,
    @Query('relatedId') relatedId?: string,
  ) {
    return this.files.save(user, file, relatedType, relatedId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.files.get(user, id);
  }

  @Get(':id/content')
  async content(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const file = await this.files.get(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.sendFile(this.files.pathFor(file));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.files.remove(user, id);
  }
}

@Module({ controllers: [FilesController], providers: [FilesService] })
export class FilesModule {}
