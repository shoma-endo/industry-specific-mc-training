-- Create Google Ads credentials table
create table google_ads_credentials (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    access_token text not null,
    refresh_token text not null, -- Google Ads API requires refresh token for offline access
    token_expires_at timestamptz not null,
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
create policy "Users can view their own Google Ads credentials"
    on google_ads_credentials for select
    using (user_id = auth.uid());

create policy "Users can insert their own Google Ads credentials"
    on google_ads_credentials for insert
    with check (user_id = auth.uid());

create policy "Users can update their own Google Ads credentials"
    on google_ads_credentials for update
    using (user_id = auth.uid());

create policy "Users can delete their own Google Ads credentials"
    on google_ads_credentials for delete
    using (user_id = auth.uid());

-- Triggers for updated_at
create trigger handle_updated_at before update on google_ads_credentials
    for each row execute procedure moddatetime (updated_at);
