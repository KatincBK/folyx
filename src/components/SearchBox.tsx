import type { RefObject } from "react";

interface SearchBoxProps {
  query: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Live substring filter over the file list. Focused with "/", cleared with Esc. */
export function SearchBox({ query, onChange, inputRef }: SearchBoxProps) {
  return (
    <div className="search-box">
      <input
        ref={inputRef}
        className="search-box__input"
        type="text"
        value={query}
        placeholder="Search sounds…  ( / )"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );
}
