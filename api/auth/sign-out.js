import { clearSessionCookies, method } from "../../src/services/vercel-request.js";
export default function handler(request, response) { if (!method(request, response, "POST")) return; clearSessionCookies(response); response.statusCode = 204; response.end(); }
