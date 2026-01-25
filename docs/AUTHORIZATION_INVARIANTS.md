# CHC-Ops Authorization Invariants (Canonical)

**Status:** LOCKED  
**Scope:** Applies to all executors registered in CHC-Ops (CIAG + Hospitality today; extensible to future domains).  
**Purpose:** Define the non-negotiable authorization and governance invariants enforced by the registry + authorize() pipeline.

---

## 0) Definitions

- **domain_id**: Logical namespace boundary for an executor (e.g., `ciag`, `hospitality`).
- **scope**: A capability string. Canonical format: `<domain_id>:<capability>` (e.g., `hospitality:execute`).
- **task_type**: High-level operation class (e.g., EXECUTE / ANALYZE / ESCALATE).
- **action**: Fine-grained domain operation (e.g., RATE_UPDATE / TARIFF_SYNC / VENDOR_INVOICE_CHECK).
- **required_scopes**: The scopes required to perform a given `task_type`.
- **domain_action_scopes**: Scopes attached to specific `action` values.

---

## 1) Security Model

This system enforces “**authority is domain-scoped**”:

- **Authority is declared by the executor spec**
- **Enforcement occurs at registration-time and runtime**
- **Cross-domain scope spoofing is blocked**
- **Actions cannot expand privilege beyond declared task authority**

---

## 2) Canonical Invariants (MUST HOLD)

### INV-1: Scope Namespace Enforcement
All scopes MUST be namespaced to their domain:

- Valid: `<domain_id>:*` (e.g., `ciag:execute`, `hospitality:analyze`)
- Invalid: missing namespace, wrong domain namespace, or non-string scope

**Result:** violations throw `INVALID_SCOPE_NAMESPACE` (or equivalent invalid-scope error).

---

### INV-2: Unknown Domain Must Fail Closed
If `domain_id` is not registered, authorization MUST fail closed.

**Result:** throws `UNKNOWN_DOMAIN`.

---

### INV-3: Task Type Must Be Supported
A task’s `task_type` must be in `spec.supported_task_types`.

**Result:** throws `INVALID_TASK` (or equivalent task-type error).

---

### INV-4: Required Scope Must Match Task Type
If a task requires `required_scopes[task_type]`, the presented `scope` MUST be one of those allowed values.

**Result:** throws `MISSING_SCOPE` (or equivalent missing/incorrect scope error).

---

### INV-5: Action Scope Subset Gate (No Privilege Escalation)
For a given domain:

`domain_action_scopes` MUST be a subset of the union of `required_scopes` across `supported_task_types`.

Intuition: **Actions may be narrower, never broader** than the executor’s declared task authorities.

**Result:** violations throw `ACTION_SCOPE_NOT_ALLOWED`.

---

### INV-6: Cross-Domain Scope Spoofing Must Fail
No executor may authorize using a scope in another domain’s namespace.

Example:  
- `ciag` EXECUTE with `hospitality:execute` → MUST FAIL  
- `hospitality` EXECUTE with `ciag:execute` → MUST FAIL

**Result:** throws `INVALID_SCOPE_NAMESPACE`.

---

### INV-7: Runtime Must Match Registration Semantics
The same invariants enforced at registration MUST also be enforced at runtime in `authorize()`.  
No “registration-only” assumptions are allowed.

**Result:** runtime violations throw the same canonical error codes.

---

## 3) Canonical Error Codes (Contract)

The following codes are part of the contract (names must remain stable):

- `UNKNOWN_DOMAIN`
- `INVALID_TASK`
- `MISSING_SCOPE`
- `INVALID_SCOPE_NAMESPACE`
- `ACTION_SCOPE_NOT_ALLOWED`

If additional codes are introduced, they must be documented here and backed by smoke tests.

---

## 4) Smoke Test Gates (Must Stay Green)

The following must remain in `npm test` and must pass:

- Authorization basic gates (CIAG + Hospitality)
- Domain mount canonical spec audit
- Action scope subset gate
- Cross-domain scope spoofing gate
- Build gate

If any new invariant is introduced, it MUST ship with:
1) a smoke test reproducer  
2) a deterministic error code  
3) documentation updates in this file

---

## 5) Change Control

This document is **canonical**. Changes require:

- A single cohesive commit message with `lock(...)` or `fix(...)` prefix
- A new tag for the milestone
- All gates green:
  - `npm test`
  - `npm run build`

No hand edits. All updates via scripts.

---

## 6) Current State

As of the current locked milestones, the following are enforced:

- Scope namespace enforcement at registration + runtime
- Action scope subset gate at registration
- Cross-domain scope spoofing gate via smoke test
- ESM-safe smoke harness

This is the foundation for Sentinel-grade governance across CHC.

