ALTER TABLE profiles ADD COLUMN IF NOT EXISTS watermark_enabled boolean default false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS watermark_opacity integer default 10;
