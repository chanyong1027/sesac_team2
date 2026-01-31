-- Ensure organization_id is always set for request logs
ALTER TABLE request_logs
    ALTER COLUMN organization_id SET NOT NULL;
