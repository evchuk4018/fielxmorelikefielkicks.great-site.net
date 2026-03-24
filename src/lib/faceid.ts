import { FaceIdEnrollmentPayload, FaceIdEnrollmentResponse, FaceIdVerifyPayload, FaceIdVerifyResponse } from '../types';

async function parseError(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      return new Error(payload.error);
    }
  } catch {
    // Ignore parse errors and fall back to default message.
  }

  return new Error(fallbackMessage);
}

export const faceid = {
  async train(payload: FaceIdEnrollmentPayload): Promise<FaceIdEnrollmentResponse> {
    const response = await fetch('/api/faceid/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await parseError(response, 'Failed to train Face ID');
    }

    return response.json() as Promise<FaceIdEnrollmentResponse>;
  },

  async verify(payload: FaceIdVerifyPayload): Promise<FaceIdVerifyResponse> {
    const response = await fetch('/api/faceid/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await parseError(response, 'Failed to verify Face ID');
    }

    return response.json() as Promise<FaceIdVerifyResponse>;
  },
};
