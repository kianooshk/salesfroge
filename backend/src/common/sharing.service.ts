import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

export type ObjectAction = 'read' | 'create' | 'edit' | 'delete';

/**
 * Implements record-level sharing:
 *  - Record owners always have full access.
 *  - Users higher in the role hierarchy see records owned by subordinates.
 *  - Explicit shares (to a user or team) grant read/edit.
 *  - Admins / roles with "viewAll" see everything.
 */
@Injectable()
export class SharingService {
  constructor(private prisma: PrismaService) {}

  private async getRolePermissions(roleId: string | null): Promise<Record<string, any>> {
    if (!roleId) return {};
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    return (role?.permissions as Record<string, any>) || {};
  }

  async can(user: AuthUser, objectType: string, action: ObjectAction): Promise<boolean> {
    if (user.isAdmin) return true;
    const perms = await this.getRolePermissions(user.roleId);
    const objectPerms = perms[objectType];
    if (!objectPerms) {
      // Default: authenticated users can read/create/edit; delete restricted.
      return action !== 'delete';
    }
    if (action === 'read') return !!objectPerms.read || !!objectPerms.viewAll;
    return !!objectPerms[action];
  }

  /** Ids of the roles at or below the user's role (user sees their subordinates). */
  private async getSubordinateRoleIds(roleId: string | null): Promise<string[]> {
    if (!roleId) return [];
    const roles = await this.prisma.role.findMany({ select: { id: true, parentId: true } });
    const childrenOf = new Map<string, string[]>();
    for (const r of roles) {
      if (r.parentId) {
        const arr = childrenOf.get(r.parentId) || [];
        arr.push(r.id);
        childrenOf.set(r.parentId, arr);
      }
    }
    const result: string[] = [];
    const stack = [roleId];
    while (stack.length) {
      const id = stack.pop() as string;
      result.push(id);
      for (const child of childrenOf.get(id) || []) stack.push(child);
    }
    return result;
  }

  private async hasViewAll(user: AuthUser, objectType: string): Promise<boolean> {
    if (user.isAdmin) return true;
    const perms = await this.getRolePermissions(user.roleId);
    return !!perms[objectType]?.viewAll;
  }

  /** Build a Prisma `where` fragment restricting a query to records the user can read. */
  async readScope(user: AuthUser, objectType: string): Promise<any> {
    if (await this.hasViewAll(user, objectType)) return {};

    const roleIds = await this.getSubordinateRoleIds(user.roleId);
    const subordinates = roleIds.length
      ? await this.prisma.user.findMany({ where: { roleId: { in: roleIds } }, select: { id: true } })
      : [];
    const ownerIds = new Set<string>([user.id, ...subordinates.map((u) => u.id)]);

    const teamIds = (
      await this.prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } })
    ).map((t) => t.teamId);

    const shares = await this.prisma.share.findMany({
      where: {
        recordType: objectType,
        OR: [{ userId: user.id }, teamIds.length ? { teamId: { in: teamIds } } : { userId: user.id }],
      },
      select: { recordId: true },
    });
    const sharedIds = shares.map((s) => s.recordId);

    return {
      OR: [{ ownerId: { in: Array.from(ownerIds) } }, sharedIds.length ? { id: { in: sharedIds } } : { id: '__none__' }],
    };
  }

  /** Whether the user can edit a specific record given its ownerId. */
  async canEditRecord(user: AuthUser, objectType: string, recordId: string, ownerId: string): Promise<boolean> {
    if (user.isAdmin) return true;
    if (ownerId === user.id) return true;
    const perms = await this.getRolePermissions(user.roleId);
    if (perms[objectType]?.modifyAll || perms[objectType]?.viewAll) return true;

    const roleIds = await this.getSubordinateRoleIds(user.roleId);
    if (roleIds.length) {
      const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { roleId: true } });
      if (owner?.roleId && roleIds.includes(owner.roleId)) return true;
    }

    const teamIds = (
      await this.prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } })
    ).map((t) => t.teamId);
    const share = await this.prisma.share.findFirst({
      where: {
        recordType: objectType,
        recordId,
        access: 'edit',
        OR: [{ userId: user.id }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : [])],
      },
    });
    return !!share;
  }
}
