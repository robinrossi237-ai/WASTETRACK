-- 026_add_whatsapp_message_template.sql
ALTER TABLE pricing_settings
ADD COLUMN IF NOT EXISTS whatsapp_message_template text;

COMMENT ON COLUMN pricing_settings.whatsapp_message_template IS
  'Template used for WhatsApp chat initiation messages.';

UPDATE pricing_settings
SET whatsapp_message_template = 'Hello {collector_name}, I am tracking my pickup for {pickup_address}.'
WHERE whatsapp_message_template IS NULL;
