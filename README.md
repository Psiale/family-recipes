# Family Recipe Tree

Private, cross-platform family recipe application built around families, branches,
people, and durable recipe lineage.

The governing architectural rule is:

> Identity != Ownership != Visibility != Lineage

## Architecture foundation

- [Domain model](docs/domain-model.md)
- [Authorization matrix](docs/authorization-matrix.md)
- [Row Level Security design](docs/rls-design.md)
- [Implementation plan](docs/implementation-plan.md)
- [Initial PostgreSQL schema](supabase/migrations/0001_initial_schema.sql)

Spanish is the default application language. English is supported from the first
release. Application-authored copy must use localization keys; user content is
stored and displayed exactly as entered.
