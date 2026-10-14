import type { Locator, Page } from '@playwright/test';
import type { BookInput } from '../support/types';

export type FormField = 'title' | 'author' | 'isbn' | 'publishedYear' | 'genre';

export interface FormValues {
  title?: string;
  author?: string;
  isbn?: string;
  publishedYear?: string;
  genre?: string;
}

export class AddBookPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly title: Locator;
  readonly author: Locator;
  readonly isbn: Locator;
  readonly year: Locator;
  readonly genre: Locator;
  readonly save: Locator;
  readonly cancel: Locator;
  readonly formAlert: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Add a book' });
    this.form = page.getByRole('form', { name: 'Add a book' });
    this.title = page.getByLabel('Title', { exact: true });
    this.author = page.getByLabel('Author', { exact: true });
    this.isbn = page.getByLabel('ISBN-13', { exact: true });
    this.year = page.getByLabel('Published year', { exact: true });
    this.genre = page.getByRole('combobox', { name: 'Genre' });
    this.save = page.getByRole('button', { name: 'Save book' });
    this.cancel = page.getByRole('button', { name: 'Cancel' });
    this.formAlert = this.form.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('./#/books/new');
  }

  field(name: FormField): Locator {
    const map: Record<FormField, Locator> = { title: this.title, author: this.author, isbn: this.isbn, publishedYear: this.year, genre: this.genre };
    return map[name];
  }

  error(name: FormField): Locator {
    return this.page.getByTestId(`error-${name}`);
  }

  async fill(values: FormValues): Promise<void> {
    if (values.title !== undefined) await this.title.fill(values.title);
    if (values.author !== undefined) await this.author.fill(values.author);
    if (values.isbn !== undefined) await this.isbn.fill(values.isbn);
    if (values.publishedYear !== undefined) await this.year.fill(values.publishedYear);
    if (values.genre !== undefined) await this.genre.selectOption(values.genre);
  }

  async fillBook(book: BookInput): Promise<void> {
    await this.fill({ title: book.title, author: book.author, isbn: book.isbn, publishedYear: String(book.publishedYear), genre: book.genre });
  }
}
