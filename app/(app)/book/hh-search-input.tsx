"use client";

/** Household search box: typing an 8-digit HOF / ITS number searches straight away, no button press needed. */
export function HhSearchInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <input
      id="hh-q"
      name="q"
      type="search"
      inputMode="search"
      defaultValue={defaultValue}
      placeholder="Search by HOF ID, name or mobile"
      autoComplete="off"
      onChange={(e) => {
        if (/^\d{8}$/.test(e.currentTarget.value.trim())) e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
