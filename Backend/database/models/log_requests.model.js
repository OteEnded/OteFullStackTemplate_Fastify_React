// log_requests — append-only request log (app/plugins/request-logger.js with log_to_database on).
// ONE name end to end: file, define(), tableName and the db.log_requests accessor.
// The table itself is authored by database/migrations/001_log_tables.sql; this model mirrors it.
export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "log_requests",
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
            request_at: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Timestamp when the request was received",
            },
            request_ip: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Client IP (the real visitor only when app.trust_proxy is set behind a proxy)",
            },
            request_to: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: "Path (+ redacted query when logging.request.log_query is on)",
            },
            request_protocol: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "http or https",
            },
            request_method: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "HTTP method (GET/POST — the API is GET + POST only)",
            },
            response_status: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "HTTP status code of the response",
            },
            duration_ms: {
                type: DataTypes.FLOAT,
                allowNull: true,
                comment: "Time from request received to response sent, in milliseconds",
            },
            request_header: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "Request headers, REDACTED (only when logging.request.log_headers is on)",
            },
            request_body: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: "Parsed request body, REDACTED (only when logging.request.log_body is on)",
            },
        },
        {
            tableName: "log_requests",
            timestamps: true, // append-only: created_at only (see log_messages.model.js)
            createdAt: "created_at",
            updatedAt: false,
            schema: schemas.project,
            hooks: hooks?.log_requests || {},
        },
    );
};
