import { toast } from "sonner";

/** Max time (ms) to wait for image generation before aborting. */
const IMAGE_TIMEOUT_MS = 60000;

function getBaseUrl(): string {
  return (
    import.meta.env.API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "/api/v1"
  );
}

export async function generateImage(prompt: string): Promise<{ url: string; blob: Blob }> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("Please enter an image prompt.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  const url = `${getBaseUrl()}/image/generate`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: trimmed }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Image generation failed (HTTP ${response.status}).`;
      try {
        const data = await response.json();
        if (typeof data?.detail === "string") message = data.detail;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("The server did not return an image.");
    }
    return { url: URL.createObjectURL(blob), blob };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      toast.error("Image generation timed out. Please try again.");
      throw new Error("Image generation timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function downloadImage(blob: Blob, filename = `taskflow-image-${Date.now()}.png`) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
