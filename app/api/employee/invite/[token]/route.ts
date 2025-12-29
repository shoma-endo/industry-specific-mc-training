import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/server/services/userService';
import { isInvitationValid } from '@/server/services/employeeInvitationService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ valid: false, error: 'トークンが必要です' }, { status: 400 });
    }

    const invitation = await userService.getEmployeeInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json({ valid: false, error: '招待が見つかりません' }, { status: 404 });
    }

    if (!isInvitationValid(invitation)) {
      return NextResponse.json(
        { valid: false, error: '招待が期限切れまたは使用済みです' },
        { status: 410 }
      );
    }

    // あなた情報取得
    const owner = await userService.getUserById(invitation.ownerUserId);
    if (!owner) {
      return NextResponse.json(
        { valid: false, error: '招待元のユーザーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      ownerName: owner.fullName || owner.lineDisplayName || 'ユーザー',
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Invite Check API Error:', error);
    return NextResponse.json({ valid: false, error: '招待の確認に失敗しました' }, { status: 500 });
  }
}
