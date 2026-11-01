// log_messages — append-only application log (lib/utility.js log() with log_to_database on).
// ONE name end to end: file, define(), tableName and the db.log_messages accessor.
// The table itself is authored by database/migrations/001_log_tables.sql; this model mirrors it.
export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "log_messages",
        {
            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                comment: "Primary key of the table",
            },
            rolling_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                allowNull: false,
                unique: true,
                comment: "Auto-incrementing secondary key (a good index; not the primary key)",
            },
            server_start_on: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Timestamp when the server started",
            },
            report_on: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Timestamp when the log message was generated",
            },
            report_by: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Source that generated the message (module path)",
            },
            level: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "info",
                validate: { isIn: [choices.log_messages_level] },
                comment: "Log level (info, warning, error)",
            },
            messages: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: "The log message content",
            },
        },
        {
            tableName: "log_messages",
            // Append-only: created_at only. Mapped explicitly — turning timestamps on
            // without the snake_case mapping broke every log write in OLS.
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false,
            schema: schemas.project,
            hooks: hooks?.log_messages || {},
        },
    );
};
