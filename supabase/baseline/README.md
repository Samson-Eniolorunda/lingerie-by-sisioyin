# Fresh-project baseline

`0000_baseline.sql` and `0001_receipts_bucket.sql` create the schema for the new, free Supabase
project. They have not been run anywhere. The product photographs live on Cloudinary, so the
`product-images` bucket in the baseline is kept only for compatibility and can be dropped.

The data-access contracts in `src/server/data/contracts.ts` match this schema; the Supabase
implementation will map `AdminProduct`, `StoredOrder`, `PromoRecord` and the rest onto these tables.
