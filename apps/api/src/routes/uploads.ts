import type { FastifyInstance } from "fastify";
import { put } from "@vercel/blob";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/;

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/uploads/image",
    { preHandler: [app.authenticate, app.requirePermission("catalog.manage")] },
    async (request, reply) => {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return reply.code(501).send({
          code: "BLOB_NOT_CONFIGURED",
          message: "ยังไม่ได้ตั้งค่า BLOB_READ_WRITE_TOKEN — ติดต่อผู้ดูแลระบบ",
        });
      }
      const file = await request.file({ limits: { fileSize: MAX_BYTES } });
      if (!file) {
        return reply.code(400).send({ code: "NO_FILE", message: "ไม่พบไฟล์ที่อัปโหลด" });
      }
      if (!ALLOWED_MIME.test(file.mimetype)) {
        return reply.code(415).send({
          code: "BAD_MIME",
          message: "รองรับเฉพาะ jpeg / png / webp / gif",
        });
      }

      const buffer = await file.toBuffer();
      if (file.file.truncated) {
        return reply.code(413).send({
          code: "TOO_LARGE",
          message: `ไฟล์เกิน ${Math.round(MAX_BYTES / 1024 / 1024)} MB`,
        });
      }

      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeName = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const blob = await put(safeName, buffer, {
        access: "public",
        contentType: file.mimetype,
      });
      return reply.send({ url: blob.url });
    },
  );
}
