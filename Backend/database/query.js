import { QueryTypes } from "sequelize";

// Raw SQL through Sequelize — use these instead of calling sequelize.query directly.
// Each one dodges a trap that already cost Ote's projects real time:
//
//   ⚠ Without `type: QueryTypes.SELECT`, sequelize.query resolves to [rows, metadata], so
//     `const [rows] = await sequelize.query(...)` silently binds the FIRST ROW (DCON).
//   ⚠ information_schema identifier columns come back positional unless cast:
//     write `table_name::text AS table_name` (DCON).
//   ⚠ Named replacements (:name) collide with Postgres casts (::type) and JSON operators
//     (->:x): write CAST(x AS type) instead of x::type next to a replacement (Oteracount
//     2026-10-04 live 500).
//
//   const rows = await select(db.sequelize, "SELECT * FROM txn_orders WHERE status = :status", { status: "open" })

export async function select(sequelize, sql, replacements = {}) {
    return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

export async function selectOne(sequelize, sql, replacements = {}) {
    const rows = await select(sequelize, sql, replacements);
    return rows[0] ?? null;
}

// INSERT/UPDATE/DELETE: returns the affected row count.
export async function execute(sequelize, sql, replacements = {}) {
    const [, meta] = await sequelize.query(sql, { replacements });
    return typeof meta === "number" ? meta : meta?.rowCount ?? 0;
}
