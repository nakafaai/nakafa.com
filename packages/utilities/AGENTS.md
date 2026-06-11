# Utilities Package Guide

`packages/utilities` is for generic cross-domain primitives only.

Do not add Nakafa domain constants, user roles, content taxonomy, Convex schema
values, AI prompt vocabulary, UI copy, or product-specific helpers here. Put
domain-owned contracts in the owning package and import that narrow module
directly.
