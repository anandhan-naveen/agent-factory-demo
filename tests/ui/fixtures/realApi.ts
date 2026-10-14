import type { APIRequestContext } from '@playwright/test';
import { randomIsbn } from '../support/data';
import type { Book, BookPage } from '../support/types';

/**
 * Integration-mode driver: no route mocking. Seeds data through the real backend with a unique
 * tag in every title (so parallel tests stay isolated) and deletes everything carrying the tag afterwards.
 */
export class RealApi {
  readonly isReal = true as const;

  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
    readonly tag: string,
  ) {}

  async seed(books: readonly Omit<Book, 'createdAt'>[]): Promise<Book[]> {
    const created: Book[] = [];
    for (const b of books) {
      const response = await this.request.post(`${this.baseUrl}/api/books`, {
        data: { title: `${b.title} ${this.tag}`, author: b.author, isbn: randomIsbn(), publishedYear: b.publishedYear, genre: b.genre },
      });
      if (response.status() !== 201) throw new Error(`Seeding failed: ${String(response.status())} ${await response.text()}`);
      let book = (await response.json()) as Book;
      if (!b.available) {
        const patched = await this.request.patch(`${this.baseUrl}/api/books/${book.id}/availability`, { data: { available: false } });
        book = (await patched.json()) as Book;
      }
      created.push(book);
    }
    return created;
  }

  async cleanup(): Promise<void> {
    const response = await this.request.get(`${this.baseUrl}/api/books`, { params: { q: this.tag, size: 100 } });
    if (!response.ok()) return;
    const page = (await response.json()) as BookPage;
    for (const book of page.items) await this.request.delete(`${this.baseUrl}/api/books/${book.id}`);
  }
}
