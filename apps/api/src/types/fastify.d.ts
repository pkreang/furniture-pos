import "fastify";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  roleKey: string;
  branchId: number | null;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
  mustChangePassword: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    sessionToken?: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      key: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
