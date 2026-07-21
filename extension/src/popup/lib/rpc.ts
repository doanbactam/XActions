// Typed wrapper around chrome.runtime.sendMessage.
// by nichxbt

export async function sendMessage<TResponse = unknown>(
  message: Record<string, unknown>,
): Promise<TResponse> {
  return chrome.runtime.sendMessage(message) as Promise<TResponse>;
}
