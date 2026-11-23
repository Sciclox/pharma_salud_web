import { handlers } from "@/auth";
import { NextRequest } from "next/server";

const { GET: originalGET, POST: originalPOST } = handlers;

function cleanSetCookieHeaders(response: Response) {
  if (!(response instanceof Response)) return response;
  const setCookieHeader = response.headers.get("Set-Cookie");
  if (!setCookieHeader) return response;

  const cookies = response.headers.getSetCookie();
  response.headers.delete("Set-Cookie");

  cookies.forEach((cookie) => {
    if (
      cookie.includes("authjs.session-token") ||
      cookie.includes("next-auth.session-token")
    ) {
      let cleanCookie = cookie
        .replace(/Max-Age=[^;]+;?/gi, "")
        .replace(/Expires=[^;]+;?/gi, "")
        .replace(/;;\s*/g, ";")
        .trim();

      if (cleanCookie.endsWith(";")) {
        cleanCookie = cleanCookie.slice(0, -1);
      }
      response.headers.append("Set-Cookie", cleanCookie);
    } else {
      response.headers.append("Set-Cookie", cookie);
    }
  });

  return response;
}

export async function GET(request: NextRequest, context: any) {
  const response = await (originalGET as any)(request, context);
  return cleanSetCookieHeaders(response);
}

export async function POST(request: NextRequest, context: any) {
  const response = await (originalPOST as any)(request, context);
  return cleanSetCookieHeaders(response);
}
