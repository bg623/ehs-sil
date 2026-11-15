export const worldToThree = ({ x, y, z }) => [x, z, -y];
export const worldToScreen = ({ x, y }, scale = 1) => [
  320 + x * scale,
  180 - y * scale,
];
