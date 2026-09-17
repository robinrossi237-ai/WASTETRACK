-- 024_update_pricing_logic.sql
-- Add new waste types, update pricing defaults, and introduce plan weight allowances.

ALTER TABLE pickup_requests
  DROP CONSTRAINT IF EXISTS pickup_requests_waste_type_check;

ALTER TABLE pickup_requests
  ADD CONSTRAINT pickup_requests_waste_type_check CHECK (
    lower(waste_type) IN ('household', 'plastic', 'organic', 'electronic', 'hazardous', 'metal', 'mixed')
  );

ALTER TABLE pricing_settings
  ALTER COLUMN plan_change_fee SET DEFAULT 500;

UPDATE pricing_settings
SET plan_change_fee = 500
WHERE plan_change_fee IS NULL OR plan_change_fee = 5000;

UPDATE pricing_settings
SET waste_type_fees = jsonb_set(
  jsonb_set(
    waste_type_fees,
    '{metal}',
    COALESCE(waste_type_fees->'metal', '{"base_fee":450,"per_kg":45}'::jsonb),
    true
  ),
  '{mixed}',
  COALESCE(waste_type_fees->'mixed', '{"base_fee":650,"per_kg":65}'::jsonb),
  true
)
WHERE waste_type_fees IS NOT NULL;

WITH updated AS (
  SELECT
    ps.id,
    jsonb_agg(
      CASE
        WHEN (p ? 'included_kg') = false THEN
          jsonb_set(
            p,
            '{included_kg}',
            to_jsonb(
              CASE p->>'id'
                WHEN 'starter' THEN 5
                WHEN 'standard' THEN 10
                WHEN 'family' THEN 15
                ELSE 0
              END
            )
          )
        ELSE p
      END
    ) AS plans
  FROM pricing_settings ps
  CROSS JOIN LATERAL jsonb_array_elements(ps.subscription_plans) AS p
  GROUP BY ps.id
)
UPDATE pricing_settings ps
SET subscription_plans = updated.plans
FROM updated
WHERE ps.id = updated.id;

UPDATE pricing_settings
SET subscription_plans = subscription_plans || '[
  {
    "id": "payg",
    "label": "Pay as you go",
    "caption": "Pay per pickup - No monthly fee",
    "price": 0,
    "pickups_per_week": 0,
    "included_kg": 0,
    "badge": null,
      "features": [
      "No subscription commitment",
      "Pay at pickup (cash)",
      "Best for occasional users"
    ],
    "active": true
  }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(subscription_plans) AS p
  WHERE p->>'id' = 'payg'
);
