ALTER TABLE IF EXISTS prompt_eval_defaults
    ADD COLUMN IF NOT EXISTS criteria_anchors_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS prompt_eval_default_drafts
    ADD COLUMN IF NOT EXISTS criteria_anchors_json JSONB NOT NULL DEFAULT '{}'::jsonb;
