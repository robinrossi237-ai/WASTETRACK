-- 021_update_plan_prices.sql
-- Set reasonable default plan prices for FCFA subscriptions.

WITH desired_prices AS (
  SELECT 'starter'::text AS id, 3000::numeric AS price
  UNION ALL SELECT 'standard', 5000
  UNION ALL SELECT 'family', 8000
),
updated AS (
  SELECT
    ps.id,
    jsonb_agg(
      CASE
        WHEN dp.id IS NOT NULL
          AND (p ? 'price' = false OR COALESCE(NULLIF(p->>'price', ''), '0')::numeric <= 0)
        THEN jsonb_set(p, '{price}', to_jsonb(dp.price))
        ELSE p
      END
    ) AS plans
  FROM pricing_settings ps
  CROSS JOIN LATERAL jsonb_array_elements(ps.subscription_plans) AS p
  LEFT JOIN desired_prices dp ON dp.id = p->>'id'
  WHERE ps.scope = 'default'
  GROUP BY ps.id
)
UPDATE pricing_settings ps
SET subscription_plans = updated.plans
FROM updated
WHERE ps.id = updated.id;
