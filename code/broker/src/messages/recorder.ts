import { Message } from "./message";

export class MessageRecorder {
  private readonly cache: Map<String, Message> = new Map();
  private upcomingGC = new Set<String>();
  private nextUpcomingGC = new Set<String>();
  private gcInterval: NodeJS.Timeout | null = null;

  private readonly gcIntervalTime = 1000 * 10; // 10 seconds

  constructor() {
    this.gcInterval = setInterval(() => {
      for (const id of this.upcomingGC) {
        this.cache.delete(id);
      }

      this.upcomingGC.clear();
      this.upcomingGC = this.nextUpcomingGC;
      this.nextUpcomingGC = new Set();
    }, this.gcIntervalTime);
  }

  get(id: string): Message | undefined {
    return this.cache.get(id);
  }

  add(message: Message): void {
    const id = message.id;
    this.cache.set(id, message);
    this.nextUpcomingGC.add(id);
  }

  has(id: String): boolean {
    return this.cache.has(id);
  }

  clear(): void {
    this.cache.clear();
    this.upcomingGC.clear();
    this.nextUpcomingGC.clear();
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    this.gcInterval = null;
  }
}
