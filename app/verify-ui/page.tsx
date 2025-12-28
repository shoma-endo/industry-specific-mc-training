'use client';

import { ViewModeBanner } from '@/components/ViewModeBanner';
import InvitationLandingClient from '../invite/[token]/InvitationLandingClient';
import { InviteDialog } from '@/components/InviteDialog';

export default function VerifyUIPage() {
  return (
    <div className="p-8 space-y-12 bg-gray-100 min-h-screen">
      <section>
        <h2 className="text-xl font-bold mb-4">1. View Mode Banner</h2>
        <div className="border p-4 bg-white rounded shadow relative h-40 overflow-hidden">
          {/* Simulate fixed positioning context */}
          <div className="transform translate-x-0">
            <ViewModeBanner />
          </div>
          <p className="mt-16 p-4">Content behind banner...</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">2. Invitation Landing Client</h2>
        <div className="border border-gray-300 rounded shadow-sm overflow-hidden h-[600px] relative">
          <div className="absolute inset-0 bg-white overflow-y-auto">
            <InvitationLandingClient
              ownerName="山田 太郎 (Verification)"
              token="dummy-token-verification"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">3. Invite Dialog Button</h2>
        <div className="bg-white p-8 rounded shadow">
          <p className="mb-2">Click to open dialog:</p>
          <InviteDialog />
        </div>
      </section>
    </div>
  );
}
