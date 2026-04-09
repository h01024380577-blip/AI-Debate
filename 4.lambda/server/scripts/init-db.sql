CREATE DATABASE IF NOT EXISTS debate_studio
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE debate_studio;

CREATE TABLE IF NOT EXISTS debate_results (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  topic           VARCHAR(255) NOT NULL,
  position_a      VARCHAR(255) NOT NULL,
  position_b      VARCHAR(255) NOT NULL,
  gemini_side     ENUM('a','b') NOT NULL,
  nova_side       ENUM('a','b') NOT NULL,
  user_choice     ENUM('a','b') NOT NULL,
  winner_model    ENUM('gemini','nova') NOT NULL,
  turn_count      INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_winner (winner_model),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
