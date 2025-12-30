import { userService } from '@/server/services/userService';
import { isInvitationValid } from '@/server/services/employeeInvitationService';
import InvitationLandingClient from './InvitationLandingClient';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;

  let invitation;
  try {
    // 招待情報の取得と検証
    invitation = await userService.getEmployeeInvitationByToken(token);
  } catch (error) {
    console.error('Failed to fetch invitation:', error);
    invitation = null;
  }

  if (!invitation || !isInvitationValid(invitation)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">招待リンクが無効です</h1>
          <p className="text-gray-600">
            この招待リンクは期限切れか、すでに使用されています。
            <br />
            新しい招待リンクを管理者に依頼してください。
          </p>
        </div>
      </div>
    );
  }

  // 招待者の情報を取得
  let ownerName = '管理者';
  try {
    const owner = await userService.getUserById(invitation.ownerUserId);
    ownerName = owner?.fullName || '管理者';
  } catch (error) {
    console.error('Failed to fetch owner info:', error);
    // デフォルト値を使用
  }

  return <InvitationLandingClient ownerName={ownerName} token={token} />;
}
