-- Add trace_id index to request_logs table for efficient filtering

CREATE INDEX IF NOT EXISTS request_logs_trace_id_idx ON request_logs(trace_id);
