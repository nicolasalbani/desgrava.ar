---
title: Rent amount threshold for AI classification
status: implemented
priority: medium
---

## Summary

When the AI classifier assigns `ALQUILER_VIVIENDA` to a new CUIT (not yet in the ProviderCatalog), validate that the invoice amount is at least $100,000 ARS. Rent invoices below this threshold are likely misclassified — the provider name may contain "alquiler" but the business is unrelated to housing rental (e.g., equipment rental, party venue rental). When the amount check fails, re-classify the provider excluding `ALQUILER_VIVIENDA` as an option, and if no deductible category fits, mark it as `NO_DEDUCIBLE`.

## Acceptance Criteria

- [ ] When `resolveCategory()` produces `ALQUILER_VIVIENDA` for a CUIT **not already in the catalog**, and the invoice `amount` is below 100,000, the system re-classifies excluding `ALQUILER_VIVIENDA`
- [ ] The re-classification calls `classifyCategory()` with the same text but an explicit instruction to exclude rent as an option
- [ ] If re-classification returns a deductible category, that category is written to the ProviderCatalog instead
- [ ] If re-classification returns `NO_DEDUCIBLE`, that is written to the catalog
- [ ] The keyword rule (`/\balquiler\b/i` in `category-classifier.ts`) is also subject to the amount threshold — if the keyword matches but amount is below threshold, skip the keyword shortcut and proceed to AI classification (excluding rent)
- [ ] When `amount` is not provided (undefined/null) in the input, skip the threshold check entirely and accept the rent classification as-is
- [ ] CUITs already in the catalog with `ALQUILER_VIVIENDA` are NOT affected — the threshold only applies during initial classification
- [ ] The threshold constant (100,000) is defined as a named constant in the classification module for easy adjustment
- [ ] Existing tests pass and new tests cover: amount above threshold → rent accepted, amount below threshold → re-classification triggered, amount undefined → rent accepted, re-classification fallback to `NO_DEDUCIBLE`

## Technical Notes

### Threshold constant

Define `RENT_AMOUNT_THRESHOLD = 100_000` in `src/lib/catalog/provider-catalog.ts` (or `category-classifier.ts` depending on where the check lives). Export it for testing.

### Implementation in `resolveCategory()`

After any classification step (PDF, web lookup, or fallback) returns `ALQUILER_VIVIENDA`, add a post-classification check:

```ts
if (
  category === "ALQUILER_VIVIENDA" &&
  input.amount != null &&
  input.amount < RENT_AMOUNT_THRESHOLD
) {
  category = await classifyCategoryExcluding(classificationText, ["ALQUILER_VIVIENDA"]);
}
```

This keeps the check centralized in `resolveCategory()` rather than scattered across each classification tier.

### Keyword rule bypass

In `classifyCategoryByKeywords()`, the function doesn't have access to the amount. Two options:

1. **Preferred**: Add an optional `excludeCategories` parameter to `classifyCategoryByKeywords()` and `classifyCategory()`. When `ALQUILER_VIVIENDA` is excluded, the keyword rule is skipped, and the AI prompt lists the exclusion.
2. **Alternative**: Handle the bypass entirely in `resolveCategory()` — if the keyword match returns `ALQUILER_VIVIENDA` and amount is below threshold, call `classifyCategory()` with an exclusion flag to get a different classification.

### Re-classification with exclusion

Add a `classifyCategoryExcluding(text, excludeCategories)` variant (or add an optional parameter to `classifyCategory`). This modifies the system prompt to instruct the AI to exclude the listed categories. The excluded categories should be removed from the `ALL_DEDUCTION_CATEGORIES` list in the prompt and an explicit instruction added: "No clasifiques como ALQUILER_VIVIENDA."

### Amount availability

The `ResolveCategoryInput` already includes `amount?: number`, and `processPullComprobantes` in `job-processor.ts` already passes the invoice amount to `resolveCategory()`. No API changes needed.

## Out of Scope

- Retroactively re-classifying existing `ALQUILER_VIVIENDA` entries in the ProviderCatalog
- Applying amount thresholds to other categories (only rent for now)
- UI changes to show the threshold or let users configure it
- Changing the threshold based on fiscal year or inflation adjustments
