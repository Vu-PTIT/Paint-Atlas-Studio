const isRiver = worldPlan.terrain === 'river_valley';
const pieces = kind => worldPlan.objects.filter(object => object.kind === kind);
const worldSeed = salt => (salt ^ worldPlan.seed) >>> 0;
const pigments = Object.fromEntries(Object.entries(worldPlan.palette).map(([name, colors]) => [
  name, colors.map(value => ink(parseInt(value.slice(1), 16)))
]));

// Each material keeps its bristle texture and value variation after tinting.
function paintWith(colors, material, strength = .70) {
  const pigmentsForMaterial = pigments[material];
  for (const pair of colors) {
    pair[0] = tint(pair[0], pigmentsForMaterial[0], strength);
    pair[1] = tint(pair[1], pigmentsForMaterial[1], strength);
  }
}
