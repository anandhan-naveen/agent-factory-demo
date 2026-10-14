import type { Ref } from 'react';
import { GENRES, type Genre } from '../api/types';
import { GENRE_LABELS } from '../domain/genres';

export interface FilterValues {
  search: string;
  genre: Genre | '';
  availableOnly: boolean;
}

interface Props {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  searchRef?: Ref<HTMLInputElement>;
}

export function Filters({ values, onChange, searchRef }: Readonly<Props>) {
  return (
    <div className="filters" role="search" aria-label="Filter the catalog">
      <div className="field filters__search">
        <label className="field__label" htmlFor="catalog-search">
          Search
        </label>
        <div className="search-input">
          <svg className="search-input__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            id="catalog-search"
            ref={searchRef}
            className="input input--search"
            type="search"
            placeholder="Title or author"
            autoComplete="off"
            maxLength={200}
            value={values.search}
            onChange={(e) => {
              onChange({ ...values, search: e.target.value });
            }}
            data-testid="search-input"
          />
        </div>
      </div>
      <div className="field filters__genre">
        <label className="field__label" htmlFor="catalog-genre">
          Genre
        </label>
        <select
          id="catalog-genre"
          className="input select"
          value={values.genre}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...values, genre: GENRES.find((g) => g === v) ?? '' });
          }}
          data-testid="genre-filter"
        >
          <option value="">All genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {GENRE_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__toggle">
        <input
          id="catalog-available"
          className="checkbox"
          type="checkbox"
          checked={values.availableOnly}
          onChange={(e) => {
            onChange({ ...values, availableOnly: e.target.checked });
          }}
          data-testid="available-only"
        />
        <label htmlFor="catalog-available">Available only</label>
      </div>
    </div>
  );
}
