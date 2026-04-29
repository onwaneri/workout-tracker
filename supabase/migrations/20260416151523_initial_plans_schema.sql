-- Create Table
Create Table plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid uuid NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON plans TO anon;

-- Enable Row Level Security
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Create Policy
CREATE POLICY "Scope plans to client_uuid"
  ON plans
  FOR ALL
  USING (
    client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid
  )
  WITH CHECK (
    client_uuid = (current_setting('request.headers', true)::json->>'x-client-uuid')::uuid
  );
  