import { describe, expect, it } from "vitest";
import { getDashboardHTML } from "../dashboard.js";
import { getShellHTML } from "../shell.js";

// The pages' scripts live in template literals, where a stray escape silently changes the code
describe("page scripts", () => {
  for (const [name, html] of [
    ["dashboard", getDashboardHTML()],
    ["project tabs", getShellHTML()],
  ]) {
    it(`${name} script parses`, () => {
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      expect(scripts.length).toBeGreaterThan(0);
      for (const script of scripts) expect(() => new Function(script)).not.toThrow();
    });
  }
});
