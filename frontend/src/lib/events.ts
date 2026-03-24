type Handler = () => void;

const unauthorizedHandlers = new Set<Handler>();

export const authEvents = {
  onUnauthorized(handler: Handler): () => void {
    unauthorizedHandlers.add(handler);
    return () => unauthorizedHandlers.delete(handler);
  },
  emitUnauthorized(): void {
    unauthorizedHandlers.forEach((h) => h());
  },
};
