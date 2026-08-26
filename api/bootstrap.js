import { bootstrap, method } from "../src/services/vercel-request.js";
export default async function handler(request, response) { if (method(request, response, "GET")) await bootstrap(request, response); }
