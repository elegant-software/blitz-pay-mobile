/**
 * BlitzPay API errors are RFC 9457 ProblemDetail bodies: `{ status, title, detail, code }`.
 * Branch on `code` (stable, e.g. `NOT_FOUND`, `EMAIL_CONFLICT`); `detail` is a
 * human-readable message whose wording can change.
 */
export interface ApiProblem {
  status: number;
  code?: string;
  detail?: string;
}

/** Reads the error body of a failed response. Never throws. */
export async function readApiProblem(response: Response): Promise<ApiProblem> {
  const problem: ApiProblem = { status: response.status };
  try {
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    if (typeof body.code === 'string') problem.code = body.code;
    if (typeof body.detail === 'string' && body.detail.trim()) problem.detail = body.detail.trim();
  } catch {
    // No body, or not JSON (e.g. a proxy error page).
  }
  return problem;
}

/** The server's `detail`, or `HTTP <status>` when it sent none. */
export async function readApiError(response: Response): Promise<string> {
  const { status, detail } = await readApiProblem(response);
  return detail ?? `HTTP ${status}`;
}
