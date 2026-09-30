-- Manual-mode Wi-Fi credentials + app settings.
-- When no openNDS gateway is deployed, customers pay and the dashboard
-- reveals the Wi-Fi SSID/password below (edited via admin settings).

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('wifi_ssid',         'MyWiFi'),
  ('wifi_password',     ''),
  ('wifi_instructions', 'Connect to the Wi-Fi network shown, then enjoy.'),
  ('manual_mode',       'true')
ON CONFLICT (key) DO NOTHING;
