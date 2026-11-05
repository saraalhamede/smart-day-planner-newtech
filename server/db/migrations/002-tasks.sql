CREATE TABLE tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  task_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('waiting', 'in_progress', 'completed') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  in_progress_date DATE GENERATED ALWAYS AS (IF(status = 'in_progress', task_date, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT tasks_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT tasks_title_check CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 180),
  CONSTRAINT tasks_time_check CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time >= '00:00:00' AND end_time < '24:00:00' AND start_time < end_time)
  ),
  UNIQUE KEY tasks_one_in_progress (user_id, in_progress_date),
  KEY tasks_user_date_time (user_id, task_date, start_time, end_time),
  KEY tasks_user_status_priority (user_id, status, priority, task_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
