// Vitest global setup: jest-dom matchers + the real i18n instance (initialises
// with the "uz" locale under jsdom, same as the app).
//
// The localStorage polyfill MUST be imported first: i18n reads localStorage at
// module-eval time, before any test runs.
import "./localStoragePolyfill";

import "@testing-library/jest-dom/vitest";

import "../i18n";
