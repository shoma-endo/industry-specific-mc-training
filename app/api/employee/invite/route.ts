import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/server/services/userService';
import { canInviteEmployee } from '@/authUtils';
import { env } from '@/env';
import { getUserFromAuthHeader } from '@/server/lib/auth-helpers';
import { isViewModeEnabled, VIEW_MODE_ERROR_MESSAGE } from '@/server/lib/view-mode';
import {
  generateExpiresAt,
  generateInvitationToken,
} from '@/server/services/employeeInvitationService';

export async function POST(req: NextRequest) {
  try {
    const authResult = await getUserFromAuthHeader(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { user } = authResult;
    if (await isViewModeEnabled(authResult.role)) {
      return NextResponse.json({ error: VIEW_MODE_ERROR_MESSAGE }, { status: 403 });
    }

    if (!canInviteEmployee(user.role)) {
      return NextResponse.json({ error: '招待権限がありません' }, { status: 403 });
    }

    // 既にスタッフがいるか確認
    const existingEmployee = await userService.getEmployeeByOwnerId(user.id);
    if (existingEmployee) {
      return NextResponse.json({ error: '既にスタッフが登録されています' }, { status: 409 });
    }

    // 既存の招待があれば削除（再発行時は常に新しいリンクを発行）
    const existingInvitation = await userService.getEmployeeInvitationByOwnerId(user.id);
    if (existingInvitation) {
      await userService.deleteEmployeeInvitation(existingInvitation.id);
    }

    // 新しい招待作成
    const invitationToken = await generateInvitationToken();
    const expiresAt = generateExpiresAt();

    await userService.createEmployeeInvitation({
      ownerUserId: user.id,
      invitationToken,
      expiresAt,
    });

    const invitationUrl = `${env.NEXT_PUBLIC_SITE_URL}/invite/${invitationToken}`;

    return NextResponse.json({
      success: true,
      invitationUrl,
      token: invitationToken,
      expiresAt,
    });
  } catch (error) {
    console.error('Invite API Error:', error);
    return NextResponse.json({ error: '招待の発行に失敗しました' }, { status: 500 });
  }
}
