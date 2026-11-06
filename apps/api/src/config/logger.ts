function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string): void {
    console.log(`${timestamp()} INFO ${message}`);
  },
  error(message: string, error?: unknown): void {
    if (error === undefined) {
      console.error(`${timestamp()} ERROR ${message}`);
      return;
    }
    console.error(`${timestamp()} ERROR ${message}`, error);
  },
};
