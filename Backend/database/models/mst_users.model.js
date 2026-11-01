// mst_users — accounts for the optional auth module (app/modules/auth/).
// ONE name end to end: file, define(), tableName and the db.mst_users accessor.
// The table itself is authored by database/migrations/003_auth_users.sql; this model mirrors it.
export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "mst_users",
        {
            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false,
                comment: "Primary key of the table",
            },
            rolling_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                allowNull: false,
                unique: true,
                comment: "Auto-incrementing secondary key (a good index; not the primary key)",
            },
            username: { type: DataTypes.STRING(100), allowNull: true, unique: true },
            display_name: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
            password_hash: { type: DataTypes.STRING(100), allowNull: true, comment: "bcrypt; null for Oteracount-only accounts" },
            oteracount_sub: { type: DataTypes.STRING(255), allowNull: true, unique: true },
            role: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "user", comment: "maps to permissions in config auth.roles" },
            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            last_login_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: "mst_users",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.mst_users || {},
        },
    );
};
