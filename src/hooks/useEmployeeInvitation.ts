import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface EmployeeInfo {
  id: string;
  lineDisplayName: string;
  linePictureUrl?: string;
  createdAt: number;
}

export interface InvitationInfo {
  token: string;
  expiresAt: number;
  url: string;
}

interface UseEmployeeInvitationOptions {
  getAccessToken: () => Promise<string>;
  refreshUser?: () => Promise<void>;
  onEmployeeDeleted?: () => void;
}

interface UseEmployeeInvitationResult {
  employee: EmployeeInfo | null;
  invitation: InvitationInfo | null;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  createInvitation: () => Promise<void>;
  deleteEmployee: () => Promise<void>;
}

type FetchEmployeeInfoResult =
  | { hasEmployee: true; employee: EmployeeInfo }
  | { hasEmployee: false }
  | { error: true; shouldAbort?: true };

type FetchInvitationStatusResult =
  | { hasActiveInvitation: true; invitation: InvitationInfo }
  | { hasActiveInvitation: false }
  | { error: true; shouldAbort?: true };

/**
 * 従業員情報を取得するヘルパー関数
 */
const fetchEmployeeInfo = async (accessToken: string): Promise<FetchEmployeeInfoResult> => {
  const empRes = await fetch('/api/employee', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (empRes.ok) {
    const empData = await empRes.json();
    if (empData?.hasEmployee && empData?.employee) {
      return { hasEmployee: true, employee: empData.employee };
    } else if (empData?.hasEmployee === false) {
      return { hasEmployee: false };
    } else {
      console.error('Unexpected employee response structure:', empData);
      toast.error('スタッフ情報の取得に失敗しました');
      return { error: true };
    }
  } else if (empRes.status >= 500) {
    console.error('Failed to fetch employee:', empRes.status);
    toast.error('スタッフ情報の取得に失敗しました');
    return { error: true, shouldAbort: true };
  } else if (empRes.status !== 404) {
    console.error('Failed to fetch employee:', empRes.status);
    toast.error('スタッフ情報の取得に失敗しました');
  }

  return { hasEmployee: false };
};

/**
 * 招待ステータスを取得するヘルパー関数
 */
const fetchInvitationStatus = async (accessToken: string): Promise<FetchInvitationStatusResult> => {
  const statusRes = await fetch('/api/employee/invite/status', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (statusRes.ok) {
    const statusData = await statusRes.json();
    if (
      statusData?.hasActiveInvitation &&
      statusData?.invitation?.token &&
      statusData?.invitation?.expiresAt &&
      statusData?.invitation?.url
    ) {
      return {
        hasActiveInvitation: true,
        invitation: {
          token: statusData.invitation.token,
          expiresAt: statusData.invitation.expiresAt,
          url: statusData.invitation.url,
        },
      };
    } else if (statusData?.hasActiveInvitation === false) {
      return { hasActiveInvitation: false };
    } else {
      console.error('Unexpected invitation status response structure:', statusData);
      toast.error('招待ステータスの取得に失敗しました');
      return { error: true };
    }
  } else if (statusRes.status >= 500) {
    console.error('Failed to fetch invitation status:', statusRes.status);
    toast.error('招待ステータスの取得に失敗しました');
    return { error: true, shouldAbort: true };
  } else if (statusRes.status !== 404) {
    console.error('Failed to fetch invitation status:', statusRes.status);
    toast.error('招待ステータスの取得に失敗しました');
  }

  return { hasActiveInvitation: false };
};

export function useEmployeeInvitation({
  getAccessToken,
  refreshUser,
  onEmployeeDeleted,
}: UseEmployeeInvitationOptions): UseEmployeeInvitationResult {
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();

      // スタッフ情報取得
      const employeeResult = await fetchEmployeeInfo(accessToken);
      if ('error' in employeeResult && employeeResult.error) {
        if (employeeResult.shouldAbort) {
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (
        'hasEmployee' in employeeResult &&
        employeeResult.hasEmployee &&
        employeeResult.employee
      ) {
        setEmployee(employeeResult.employee);
        setInvitation(null);
        setLoading(false);
        return;
      }

      // スタッフがいない場合のみ招待情報を取得
      setEmployee(null);
      const invitationResult = await fetchInvitationStatus(accessToken);
      if ('error' in invitationResult && invitationResult.error) {
        if (invitationResult.shouldAbort) {
          setLoading(false);
          return;
        }
      }

      if (
        'hasActiveInvitation' in invitationResult &&
        invitationResult.hasActiveInvitation &&
        invitationResult.invitation
      ) {
        setInvitation(invitationResult.invitation);
      } else {
        setInvitation(null);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('ステータスの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const createInvitation = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/employee/invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '招待の作成に失敗しました' }));
        throw new Error(data.error || '招待の作成に失敗しました');
      }

      const data = await res.json();

      if (!data.token || !data.expiresAt || !data.invitationUrl) {
        console.error('Invalid invitation response:', data);
        throw new Error('招待リンクのレスポンスが不正です');
      }

      setInvitation({
        token: data.token,
        expiresAt: data.expiresAt,
        url: data.invitationUrl,
      });
      toast.success('招待リンクを発行しました');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '招待の作成に失敗しました';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const deleteEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/employee', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'スタッフの削除に失敗しました' }));
        throw new Error(data.error || 'スタッフの削除に失敗しました');
      }

      setEmployee(null);
      toast.success('スタッフを削除しました');
      try {
        await refreshUser?.();
      } catch (error) {
        console.error('Failed to refresh user after deletion:', error);
        toast.warning(
          'スタッフの削除は完了しましたが、画面の更新に失敗しました。ページを再読み込みしてください。'
        );
      }
      onEmployeeDeleted?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'スタッフの削除に失敗しました';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, refreshUser, onEmployeeDeleted]);

  return {
    employee,
    invitation,
    loading,
    fetchStatus,
    createInvitation,
    deleteEmployee,
  };
}
