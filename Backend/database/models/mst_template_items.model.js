// mst_template_items — the DEMO feature's table (mst_ = master data: what exists).
// Replace it with your own domain; the wizard can delete the whole demo chain.
// ONE name end to end: file, define(), tableName and the db.mst_template_items accessor.
// The table itself is authored by database/migrations/002_demo_template_items.sql; this model mirrors it.
export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "mst_template_items",
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
            name: {
                type: DataTypes.STRING(200),
                allowNull: false,
            },
            summary: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: "",
            },
            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "draft",
                validate: { isIn: [choices.mst_template_items_status] },
            },
            priority: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "medium",
                validate: { isIn: [choices.mst_template_items_priority] },
            },
        },
        {
            tableName: "mst_template_items",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            schema: schemas.project,
            hooks: hooks?.mst_template_items || {},
        },
    );
};
