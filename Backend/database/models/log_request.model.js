export default (sequelize, DataTypes, schemas, choices, hooks) => {
    return sequelize.define(
        "LogRequests",
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
                comment: "Auto-incrementing unique identifier for each log request",
            },
            request_at: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "Timestamp when the request was made",
            },
            request_ip: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "IP address from which the request originated",
            },
            request_to: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Endpoint or URL to which the request was made",
            },
            request_protocol: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Protocol used for the request (e.g., HTTP/1.1, HTTP/2)",
            },
            request_method: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "HTTP method used for the request (e.g., GET, POST, PUT, DELETE)",
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
                type: DataTypes.JSONB,
                allowNull: true,
                comment: "Request headers, REDACTED (only when logging.request.log_headers is on)",
            },
            request_body: {
                type: DataTypes.JSONB,
                allowNull: true,
                comment: "Parsed request body, REDACTED (only when logging.request.log_body is on)",
            },
        },
        {
            tableName: "log_requests",
            // Append-only: created_at only. Mapped explicitly — turning timestamps
            // on without the snake_case mapping broke every log write in OLS.
            timestamps: true,
            createdAt: "created_at",
            updatedAt: false,
            schema: schemas.project,
            hooks: hooks?.logRequest || {}
        },
    );
};
