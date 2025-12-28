import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/server/services/userService';
import { EmployeeDeletionService } from '@/server/services/employeeDeletionService';
import { isOwner } from '@/authUtils';
import { getUserFromAuthHeader } from '@/server/lib/auth-header';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserFromAuthHeader(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    if (!isOwner(authResult.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const { user } = authResult;

    // スタッフがいるか確認
    const employee = await userService.getEmployeeByOwnerId(user.id);

    if (employee) {
      return NextResponse.json({
        hasEmployee: true,
        employee: {
          id: employee.id,
          lineDisplayName: employee.lineDisplayName,
          linePictureUrl: employee.linePictureUrl,
          createdAt: employee.createdAt,
        },
      });
    }

    return NextResponse.json({
      hasEmployee: false,
      employee: null,
    });
  } catch (error) {
    console.error('Get Employee API Error:', error);
    return NextResponse.json({ error: 'スタッフ情報の取得に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getUserFromAuthHeader(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    // owner role check using authUtils
    if (!isOwner(authResult.role)) {
      return NextResponse.json({ error: '削除権限がありません' }, { status: 403 });
    }

    const { user } = authResult;

    const employee = await userService.getEmployeeByOwnerId(user.id);
    if (!employee) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 });
    }

    const deletionService = new EmployeeDeletionService();
    await deletionService.deleteEmployee(employee.id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Employee API Error:', error);
    return NextResponse.json({ error: 'スタッフの削除に失敗しました' }, { status: 500 });
  }
}
