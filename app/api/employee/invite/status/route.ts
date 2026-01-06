import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/server/services/userService';
import { canInviteEmployee } from '@/authUtils';
import { env } from '@/env';
import { isInvitationValid } from '@/server/services/employeeInvitationService';
import { getUserFromAuthHeader } from '@/server/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserFromAuthHeader(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { user, role } = authResult;

    if (!canInviteEmployee(role)) {
      return NextResponse.json({ error: '招待権限がありません' }, { status: 403 });
    }

    const existingEmployee = await userService.getEmployeeByOwnerId(user.id);
    if (existingEmployee) {
      return NextResponse.json({
        hasEmployee: true,
        employee: {
          id: existingEmployee.id,
          lineDisplayName: existingEmployee.lineDisplayName,
          linePictureUrl: existingEmployee.linePictureUrl,
          createdAt: existingEmployee.createdAt,
        },
        hasActiveInvitation: false,
        invitation: null,
      });
    }

    const existingInvitation = await userService.getEmployeeInvitationByOwnerId(user.id);
    if (!existingInvitation || !isInvitationValid(existingInvitation)) {
      return NextResponse.json({
        hasEmployee: false,
        employee: null,
        hasActiveInvitation: false,
        invitation: null,
      });
    }

    const invitationUrl = `${env.NEXT_PUBLIC_SITE_URL}/invite/${existingInvitation.invitationToken}`;

    return NextResponse.json({
      hasEmployee: false,
      employee: null,
      hasActiveInvitation: true,
      invitation: {
        token: existingInvitation.invitationToken,
        url: invitationUrl,
        expiresAt: existingInvitation.expiresAt,
        createdAt: existingInvitation.createdAt,
      },
    });
  } catch (error) {
    console.error('Invite Status API Error:', error);
    return NextResponse.json({ error: '招待ステータスの取得に失敗しました' }, { status: 500 });
  }
}
