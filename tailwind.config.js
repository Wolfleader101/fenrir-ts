const { tailwindTransform } = require("postcss-lit");

module.exports = {
  content: {
    files: ["./src/**/*.{js,ts}"],
    transform: {
      ts: tailwindTransform,
    },
  },
};
