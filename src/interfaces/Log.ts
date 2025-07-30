export interface Log {
  id?: number;
  timestamp: string;
  ip_address: string;
  table_name?: string;
  controller: string;
  original_path: string;
  http_method: string;
  request_body?: string;
  user_id?: string;
  status_code?: number;
  created_at?: string;
}

export interface CreateLogData {
  ip_address: string;
  table_name?: string;
  controller: string;
  original_path: string;
  http_method: string;
  request_body?: string;
  user_id?: string;
  status_code?: number;
}