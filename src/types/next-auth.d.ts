import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    sucursalId?: number | null;
    sucursalName?: string | null;
    genero?: string | null;
  }

  interface Session {
    error?: string;
    user: {
      id: string;
      role: string;
      sucursalId: number | null;
      sucursalName: string | null;
      genero: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    sucursalId?: number | null;
    sucursalName?: string | null;
    genero?: string | null;
  }
}
