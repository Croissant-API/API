/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */

/**
 * @file Jest test suite for the application.
 * @module __tests__/index.test
 */

/**
 * Jest test suite for the application.
 *
 * @description
 * This test suite verifies the application's basic setup, including server definition,
 * port configuration, container initialization, and service bindings.
 *
 * Jest Methods Memo:
 * - `describe(name, fn)`: Creates a block that groups together several related tests.
 * - `it(name, fn)`: Defines a single test case with a descriptive name. Alias: `test(name, fn)`.
 * - `expect(value)`: Creates an assertion about a value.
 * - `toBe(value)`: Matches primitive values or checks referential identity.
 * - `toEqual(value)`: Matches when two objects have the same value.  For deep equality, especially useful for objects and arrays.
 * - `toBeDefined()`: Asserts that a value is not `undefined`.
 * - `toBeUndefined()`: Asserts that a value is `undefined`.
 * - `toBeNull()`: Asserts that a value is `null`.
 * - `toBeTruthy()`: Asserts that a value is truthy.
 * - `toBeFalsy()`: Asserts that a value is falsy.
 * - `toBeGreaterThan(number)`: Asserts that a value is greater than a number.
 * - `toBeLessThan(number)`: Asserts that a value is less than a number.
 * - `toBeGreaterThanOrEqual(number)`: Asserts that a value is greater than or equal to a number.
 * - `toBeLessThanOrEqual(number)`: Asserts that a value is less than or equal to a number.
 * - `toContain(item)`: Asserts that an array or string contains a particular item.
 * - `toMatch(regexp)`: Asserts that a string matches a regular expression.
 * - `toThrow(error)`: Asserts that a function throws an error.
 * - `beforeEach(fn, timeout)`: Function to run before each test in the file.
 * - `afterEach(fn, timeout)`: Function to run after each test in the file.
 * - `beforeAll(fn, timeout)`: Function to run once before all tests in the file.
 * - `afterAll(fn, timeout)`: Function to run once after all tests in the file.
 * - `jest.fn()`: Creates a mock function.
 * - `jest.spyOn(object, methodName)`: Spies on a method of an object.
 * - `jest.mock(moduleName, factory, options)`: Mocks a module.
 */

const app = require("../dist/app").app;
const container = require("../dist/container").default;
const request = require("supertest");

test("Simple assertion", () => {
  expect(true).toBe(true);
});

test("Server definition", () => {
  expect(app).toBeDefined();
});

test("Exemple request to /exemple", async () => {
    const response = await request(app).get("/exemple");
    const expected = container.get("ExempleService").getHelloWorld();
    console.log("response", response);
    expect(response.statusCode).toBe(200);
    expect(response.text).toEqual(expected);
});


test("Exemple request to /exemple/user", async () => {
    const response = await request(app).get("/exemple/user");
    const expected = container.get("ExempleService").getHelloWorldWithName("user");
    console.log("response", response);
    expect(response.statusCode).toBe(200);
    expect(response.text).toEqual(expected);
});