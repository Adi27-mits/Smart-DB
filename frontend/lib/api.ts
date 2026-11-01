/**
 * api.ts — Central fetch utility for the Smart Database Visualizer frontend
 *
 * All requests to the backend go through here.
 * Base URL is controlled by NEXT_PUBLIC_API_URL (defaults to localhost:5000).
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/** Generic API error with HTTP status attached */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public sqlState?: string | null
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** The shape of every backend response */
interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  code?: string
  sqlState?: string | null
}

/**
 * Core fetch wrapper.
 * - Always sends/receives JSON
 * - Throws ApiError on non-2xx or success:false responses
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      json.message || `Request failed with status ${res.status}`,
      json.code,
      json.sqlState
    )
  }

  // Return data if present, otherwise the whole response
  return (json.data !== undefined ? json.data : json) as T
}

/** GET helper */
export function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: 'GET' })
}

/** POST helper */
export function apiPost<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** PATCH helper */
export function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** PUT helper */
export function apiPut<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: 'PUT',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

/** DELETE helper */
export function apiDelete<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

/**
 * Upload a file via multipart/form-data.
 * Does NOT set Content-Type header (let the browser set the boundary).
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  })

  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      json.message || `Request failed with status ${res.status}`
    )
  }

  return (json.data !== undefined ? json.data : json) as T
}
