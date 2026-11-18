import { PriceRange } from "./PriceRange";
import { CATEGORIES, GENDERS, PRICE_CEILING } from "@/schemas/catalogue";
import type { CatalogueQuery } from "@/server/queries/catalogue";

const group = "border-b border-line py-4";
const legend = "mb-1 text-sm font-medium uppercase tracking-wider text-subtle";
const row = "flex min-h-12 cursor-pointer items-center gap-3 text-base";
const radio = "size-5 shrink-0 accent-[var(--c-primary)]";

/** Plain controls inside a GET form, so filters work with or without scripting and live in the URL. */
export function FilterFields({
  query,
  idPrefix,
}: {
  readonly query: CatalogueQuery;
  readonly idPrefix: string;
}) {
  return (
    <>
      <fieldset className={group}>
        <legend className={legend}>Category</legend>
        {CATEGORIES.map((c) => (
          <label key={c} className={row}>
            <input
              type="radio"
              name="category"
              value={c}
              defaultChecked={query.category === c}
              className={radio}
            />
            {c}
          </label>
        ))}
        <label className={row}>
          <input
            type="radio"
            name="category"
            value=""
            defaultChecked={!query.category}
            className={radio}
          />
          All categories
        </label>
      </fieldset>

      <fieldset className={group}>
        <legend className={legend}>For</legend>
        {GENDERS.map((g) => (
          <label key={g} className={row}>
            <input
              type="radio"
              name="gender"
              value={g}
              defaultChecked={query.gender === g}
              className={radio}
            />
            {g}
          </label>
        ))}
        <label className={row}>
          <input
            type="radio"
            name="gender"
            value=""
            defaultChecked={!query.gender}
            className={radio}
          />
          Everyone
        </label>
      </fieldset>

      <fieldset className={group}>
        <legend className={legend}>Price (₦)</legend>
        <PriceRange
          idPrefix={idPrefix}
          ceiling={PRICE_CEILING}
          initialMin={query.minPrice}
          initialMax={query.maxPrice}
        />
      </fieldset>

      <fieldset className={group}>
        <legend className={legend}>Delivery</legend>
        <label className={row}>
          <input
            type="radio"
            name="delivery"
            value=""
            defaultChecked={!query.delivery}
            className={radio}
          />
          Any
        </label>
        <label className={row}>
          <input
            type="radio"
            name="delivery"
            value="standard"
            defaultChecked={query.delivery === "standard"}
            className={radio}
          />
          Standard
        </label>
        <label className={row}>
          <input
            type="radio"
            name="delivery"
            value="express"
            defaultChecked={query.delivery === "express"}
            className={radio}
          />
          Express
        </label>
      </fieldset>

      <fieldset className={group}>
        <legend className="sr-only">Availability</legend>
        <label className={row}>
          <input
            type="checkbox"
            name="stock"
            value="1"
            defaultChecked={Boolean(query.inStockOnly)}
            className={radio}
          />
          In stock only
        </label>
        <label className={row}>
          <input
            type="checkbox"
            name="is_new"
            value="true"
            defaultChecked={Boolean(query.newOnly)}
            className={radio}
          />
          New arrivals only
        </label>
      </fieldset>
    </>
  );
}
