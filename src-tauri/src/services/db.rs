use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

const DEFAULT_FILTER_WORDS: &[&str] = &["嗯", "啊", "呃", "哦", "那个", "这个", "就是", "然后", "反正", "就是说"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryItem {
    pub id: i64,
    pub created_at: String,
    pub source_text: String,
    pub final_text: String,
    pub text_mode: String,
    pub asr_provider: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewHistoryItem {
    pub source_text: String,
    pub final_text: String,
    pub text_mode: String,
    pub asr_provider: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), rusqlite::Error> {
        self.conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source_text TEXT NOT NULL,
                final_text TEXT NOT NULL,
                text_mode TEXT NOT NULL,
                asr_provider TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS filter_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            "#,
        )?;

        self.seed_default_filter_words()?;
        Ok(())
    }

    fn seed_default_filter_words(&self) -> Result<(), rusqlite::Error> {
        let now = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

        for word in DEFAULT_FILTER_WORDS {
            self.conn.execute(
                "INSERT OR IGNORE INTO filter_words (word, is_default, created_at) VALUES (?1, 1, ?2)",
                params![word, now],
            )?;
        }

        Ok(())
    }

    pub fn insert_history(&self, item: NewHistoryItem) -> Result<HistoryItem, rusqlite::Error> {
        let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

        self.conn.execute(
            r#"
            INSERT INTO history (created_at, source_text, final_text, text_mode, asr_provider)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                created_at,
                item.source_text,
                item.final_text,
                item.text_mode,
                item.asr_provider,
            ],
        )?;

        let id = self.conn.last_insert_rowid();
        self.get_history_by_id(id)
    }

    pub fn list_history(&self) -> Result<Vec<HistoryItem>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, created_at, source_text, final_text, text_mode, asr_provider
            FROM history
            ORDER BY created_at DESC, id DESC
            "#,
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(HistoryItem {
                id: row.get(0)?,
                created_at: row.get(1)?,
                source_text: row.get(2)?,
                final_text: row.get(3)?,
                text_mode: row.get(4)?,
                asr_provider: row.get(5)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_history_by_id(&self, id: i64) -> Result<HistoryItem, rusqlite::Error> {
        self.conn.query_row(
            r#"
            SELECT id, created_at, source_text, final_text, text_mode, asr_provider
            FROM history
            WHERE id = ?1
            "#,
            params![id],
            |row| {
                Ok(HistoryItem {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    source_text: row.get(2)?,
                    final_text: row.get(3)?,
                    text_mode: row.get(4)?,
                    asr_provider: row.get(5)?,
                })
            },
        )
    }

    pub fn count_default_filter_words(&self) -> Result<i64, rusqlite::Error> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM filter_words WHERE is_default = 1",
            [],
            |row| row.get(0),
        )
    }
}

impl HistoryItem {
    pub fn new_for_test(id: i64, source_text: String, final_text: String) -> Self {
        Self {
            id,
            created_at: "2026-08-09T00:00:00Z".to_string(),
            source_text,
            final_text,
            text_mode: "Normal".to_string(),
            asr_provider: "mock".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_schema_and_default_filter_words() {
        let db = Database::in_memory().expect("database opens");

        let count = db.count_default_filter_words().expect("count succeeds");

        assert_eq!(count as usize, DEFAULT_FILTER_WORDS.len());
    }

    #[test]
    fn inserts_and_lists_history_newest_first() {
        let db = Database::in_memory().expect("database opens");

        let first = db
            .insert_history(NewHistoryItem {
                source_text: "原始一".to_string(),
                final_text: "最终一".to_string(),
                text_mode: "Normal".to_string(),
                asr_provider: "mock".to_string(),
            })
            .expect("first insert succeeds");
        let second = db
            .insert_history(NewHistoryItem {
                source_text: "原始二".to_string(),
                final_text: "最终二".to_string(),
                text_mode: "Developer".to_string(),
                asr_provider: "mock".to_string(),
            })
            .expect("second insert succeeds");

        let items = db.list_history().expect("list succeeds");

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, second.id);
        assert_eq!(items[1].id, first.id);
        assert_eq!(items[0].final_text, "最终二");
    }
}
