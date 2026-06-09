export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
}

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function apiFetch<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | null;
    throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected request error';
}
