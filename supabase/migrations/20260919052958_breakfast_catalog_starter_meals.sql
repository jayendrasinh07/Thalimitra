-- Starter Breakfast catalog for the Gandhinagar pilot.
-- These are catalog-only meals; Kitchen chooses which dates to publish them.
INSERT INTO public.meals (
  seed_key,
  name,
  description,
  meal_type,
  diet_type,
  base_price,
  is_active
)
VALUES
  (
    'breakfast-vegetable-poha',
    'Fresh Vegetable Poha Box',
    'Light poha with seasonal vegetables, roasted peanuts, fresh coriander and lemon.',
    'breakfast',
    'low_oil_fit',
    59.00,
    true
  ),
  (
    'breakfast-thepla-curd',
    'Methi Thepla, Curd & Pickle',
    'Four soft methi theplas served with fresh curd and traditional Gujarati pickle.',
    'breakfast',
    'standard_gujarati',
    79.00,
    true
  ),
  (
    'breakfast-moong-chilla',
    'Moong Dal Chilla & Green Chutney',
    'Two protein-rich moong dal chillas with seasonal vegetables and fresh green chutney.',
    'breakfast',
    'low_oil_fit',
    89.00,
    true
  )
ON CONFLICT (seed_key) DO NOTHING;
