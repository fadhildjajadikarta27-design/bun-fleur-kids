import { handleActions } from "../../server/src/http.js";

export default function handler(request: Request, context?: { ip?: string }): Promise<Response> {
  return handleActions(request, { ip: context?.ip });
}
