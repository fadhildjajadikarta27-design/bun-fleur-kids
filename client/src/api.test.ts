import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { api } from "./api";

afterEach(() => mock.restore());

test("the admin affiliate list has a deadline and reports a timeout", async () => {
  const fetchMock = spyOn(globalThis, "fetch");
  fetchMock.mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"));
  await expect(api.adminListAffiliates({})).rejects.toThrow("Server terlalu lama memuat daftar afiliasi.");
  expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

test("an invalid affiliate list response does not look like an empty list", async () => {
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}));
  await expect(api.adminListAffiliates({})).rejects.toThrow("Server mengirim respons daftar afiliasi yang tidak valid.");
});

test("an expired session tells the admin to sign in again", async () => {
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 401 }));
  await expect(api.adminListAffiliates({})).rejects.toThrow("Sesi admin berakhir. Masuk kembali.");
});
