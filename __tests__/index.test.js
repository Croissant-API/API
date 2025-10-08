

const app = require("../dist/app").app;

test("Simple assertion", () => {
  expect(true).toBe(true);
});

test("Server definition", () => {
  expect(app).toBeDefined();
});


