import { expect, test } from "bun:test";
import netlifyHandler from "../../netlify/functions/actions.js";

test("production transport does not bootstrap the database for authentication status reads", async () => {
  const response = await netlifyHandler(new Request("https://example.test/api/actions", {
    method: "POST", headers: { "content-type": "application/json" }, body: '{"action":"adminStatus"}',
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
