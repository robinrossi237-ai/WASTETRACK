export const DEFAULT_WHATSAPP_TEMPLATE =
  "Hello {collector_name}, I am tracking my pickup for {pickup_address}.";

type TemplateVars = {
  collector_name?: string | null;
  pickup_address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
};

const normalizeValue = (value?: string | null) => (value ? value : "");

export const normalizeWhatsappTemplate = (value?: string | null) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return DEFAULT_WHATSAPP_TEMPLATE;
};

export const resolveWhatsappTemplate = (template: string, vars: TemplateVars) =>
  template
    .replace(/\{collector_name\}/g, normalizeValue(vars.collector_name))
    .replace(/\{pickup_address\}/g, normalizeValue(vars.pickup_address))
    .replace(/\{scheduled_date\}/g, normalizeValue(vars.scheduled_date))
    .replace(/\{scheduled_time\}/g, normalizeValue(vars.scheduled_time));
