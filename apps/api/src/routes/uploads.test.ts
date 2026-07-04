import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";
import { createTestUser, sessionCookie, resetAuthTables } from "../test-helpers/auth.js";
import { put } from "@vercel/blob";

vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

const putMock = vi.mocked(put);

/** Builds a raw multipart/form-data body wrapping a single file field. */
function multipartFile(filename: string, contentType: string, data: Buffer) {
  const boundary = "----uploadtestboundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("uploads routes", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(async () => {
    await resetAuthTables();
    putMock.mockReset();
  });
  afterEach(() => {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 501 when BLOB_READ_WRITE_TOKEN is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const part = multipartFile("photo.png", "image/png", Buffer.from("fake"));
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      cookies: await sessionCookie(adminId),
      headers: part.headers,
      payload: part.body,
    });
    await app.close();
    expect(res.statusCode).toBe(501);
    expect(res.json().code).toBe("BLOB_NOT_CONFIGURED");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 415 for a disallowed mime type", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const part = multipartFile("evil.svg", "image/svg+xml", Buffer.from("<svg/>"));
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      cookies: await sessionCookie(adminId),
      headers: part.headers,
      payload: part.body,
    });
    await app.close();
    expect(res.statusCode).toBe(415);
    expect(res.json().code).toBe("BAD_MIME");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("returns 502 with the real reason when the blob upload fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    putMock.mockRejectedValueOnce(new Error("Access denied, please provide a valid token"));
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const part = multipartFile("photo.png", "image/png", Buffer.from("fake"));
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      cookies: await sessionCookie(adminId),
      headers: part.headers,
      payload: part.body,
    });
    await app.close();
    // Must NOT leak through as a generic 500 INTERNAL anymore.
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("BLOB_UPLOAD_FAILED");
    expect(res.json().message).toContain("Access denied");
    expect(putMock).toHaveBeenCalledOnce();
  });

  it("returns the blob url on a successful upload", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    putMock.mockResolvedValueOnce({ url: "https://blob.example/products/x.png" } as never);
    const adminId = await createTestUser({ username: "admin", permissions: ["catalog.manage"] });
    const app = buildApp();
    const part = multipartFile("photo.png", "image/png", Buffer.from("fake"));
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      cookies: await sessionCookie(adminId),
      headers: part.headers,
      payload: part.body,
    });
    await app.close();
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toBe("https://blob.example/products/x.png");
    // Images are served as plain public <img src> URLs, so the store must be
    // public — lock the contract that we always upload with access: "public".
    expect(putMock).toHaveBeenCalledOnce();
    expect(putMock.mock.calls[0][2]).toMatchObject({ access: "public" });
  });

  it("rejects a user without catalog.manage", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const viewerId = await createTestUser({ username: "viewer", permissions: ["catalog.view"] });
    const app = buildApp();
    const part = multipartFile("photo.png", "image/png", Buffer.from("fake"));
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      cookies: await sessionCookie(viewerId),
      headers: part.headers,
      payload: part.body,
    });
    await app.close();
    expect(res.statusCode).toBe(403);
    expect(putMock).not.toHaveBeenCalled();
  });
});
