const preset = require("@arta/design-system/tailwind-preset.cjs");
module.exports = {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "../../packages/design-system/src/**/*.{ts,tsx}"],
};
