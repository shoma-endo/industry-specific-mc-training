-- Create Google Ads credentials table
create table google_ads_credentials (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    google_account_email text, -- Identifier for the connected account
    access_token text not null,
    refresh_token text not null, -- Google Ads API requires refresh token for offline access
    access_token_expires_at timestamptz not null,
    scope text[] not null default '{}',
    manager_customer_id text, -- Optional: MCC ID if applicable
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint google_ads_credentials_pkey primary key (id),
    constraint google_ads_credentials_user_id_key unique (user_id)
);

-- Enable RLS
alter table google_ads_credentials enable row level security;

-- Policies
create policy "google_ads_credentials_select_own"
    on google_ads_credentials for select
    using (user_id = auth.uid());

create policy "google_ads_credentials_insert_own"
    on google_ads_credentials for insert
    with check (user_id = auth.uid());

create policy "google_ads_credentials_update_own"
    on google_ads_credentials for update
    using (user_id = auth.uid());

create policy "google_ads_credentials_delete_own"
    on google_ads_credentials for delete
    using (user_id = auth.uid());
